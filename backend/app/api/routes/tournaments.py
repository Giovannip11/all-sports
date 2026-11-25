"""TOUR-01 — campeonatos amadores em mata-mata.

Usa o modelo já existente (migration 0005): `tournaments`, `tournament_teams`,
`tournament_team_members`, `tournament_phases` e `tournament_matches`, com as
regras nos triggers do banco (capacidade, lista de espera, aprovação, avanço do
vencedor para a próxima partida). A criação usa a função
`create_tournament_event` (migration 0010).
"""

import math
import random

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import authenticated_user, bearer_token
from app.core.sports import sport_id_for_slug, sport_slug_for_id
from app.core.supabase import get_supabase_admin_client, get_user_scoped_client
from app.schemas.tournaments import (
    MatchOut,
    MatchResult,
    MatchTeamOut,
    RoundOut,
    TeamDecision,
    TeamRegister,
    TournamentCreate,
    TournamentOut,
    TournamentTeamOut,
)

router = APIRouter(prefix="/tournaments", tags=["tournaments"])

# Plano escolhido no app (user_metadata.plan) -> código da tabela `plans`.
PLAN_CODE = {"gratuito": "free", "casual": "casual", "intermediario": "intermediate", "arena": "arena"}
TOURNAMENT_PLANS = ("intermediate", "arena")

ERRORS = {
    "plan_required": (403, "Seu plano não permite isso. Torneios são dos planos Intermediário e Arena."),
    "plan_limit_exceeded": (403, "Você atingiu o limite do seu plano para torneios."),
    "profile_incomplete": (
        400,
        "Complete seu perfil (data de nascimento e gênero) antes de entrar em um torneio.",
    ),
    "already_in_tournament": (409, "Você já está em uma equipe deste torneio."),
    "tournament_full": (409, "O torneio já está com todas as vagas de equipes preenchidas."),
    "event_not_open": (400, "As inscrições deste torneio não estão abertas."),
    "registration_closed": (400, "O prazo de inscrição terminou."),
    "event_private": (404, "Torneio não encontrado."),
    "event_not_found": (404, "Torneio não encontrado."),
    "team_not_found": (404, "Equipe não encontrada."),
    "invalid_team_transition": (400, "Essa equipe não está aguardando decisão."),
    "event_already_started": (400, "O torneio já começou; não dá para cancelar a equipe."),
    "starts_in_past": (400, "A data do torneio precisa ser no futuro."),
    "winner_required": (400, "Empate no mata-mata: escolha quem avança."),
    "team_not_confirmed": (400, "Só equipes confirmadas entram no chaveamento."),
    "tournaments_team_size_chk": (400, "O máximo de jogadores por equipe não pode ser menor que o mínimo."),
}


def _translate(exc: Exception, fallback: str) -> HTTPException:
    message = str(exc)
    if "unique" in message.lower() and "name" in message.lower():
        return HTTPException(status_code=409, detail="Já existe uma equipe com esse nome no torneio.")
    for code, (http_status, detail) in ERRORS.items():
        if code in message:
            return HTTPException(status_code=http_status, detail=detail)
    return HTTPException(status_code=400, detail=fallback)


def _ensure_tournament_plan(admin, user) -> None:
    """Só organizadores nos planos Intermediário/Arena criam torneios. O plano é
    escolhido no app (user_metadata) e aqui a assinatura do banco é alinhada a
    ele, já que é ela que os triggers consultam (has_permission)."""
    metadata = user.user_metadata or {}
    if metadata.get("role") != "organize":
        raise HTTPException(
            status_code=403,
            detail="Só contas de organizador criam torneios. Troque o tipo de conta no perfil.",
        )
    code = PLAN_CODE.get(metadata.get("plan", "gratuito"), "free")
    if code not in TOURNAMENT_PLANS:
        raise HTTPException(
            status_code=403,
            detail="Torneios fazem parte dos planos Intermediário e Arena. Mude em Perfil → Plano atual.",
        )
    plan = admin.table("plans").select("id").eq("code", code).execute().data[0]
    current = (
        admin.table("subscriptions")
        .select("id,plan_id")
        .eq("user_id", user.id)
        .in_("status", ["trialing", "active", "past_due"])
        .execute()
        .data
    )
    if current and current[0]["plan_id"] == plan["id"]:
        return
    if current:
        admin.table("subscriptions").update({"plan_id": plan["id"]}).eq("id", current[0]["id"]).execute()
    else:
        admin.table("subscriptions").insert({"user_id": user.id, "plan_id": plan["id"]}).execute()


def _tournament_rows(admin, tournament_id: str) -> tuple[dict, dict]:
    events = (
        admin.table("events").select("*").eq("id", tournament_id).eq("kind", "tournament").execute().data
    )
    details = admin.table("tournaments").select("*").eq("event_id", tournament_id).execute().data
    if not events or not details:
        raise HTTPException(status_code=404, detail="Torneio não encontrado.")
    return events[0], details[0]


def _names(admin, user_ids: list[str]) -> dict[str, str]:
    ids = [u for u in set(user_ids) if u]
    if not ids:
        return {}
    rows = admin.table("profiles").select("id,name").in_("id", ids).execute().data
    return {r["id"]: r["name"] for r in rows}


def first_round_pairs(teams: list[str]) -> list[tuple[str | None, str | None]]:
    """Confrontos da 1ª rodada para um chaveamento de tamanho 2^k. As vagas que
    sobram (byes) ficam no fim da lista, então as primeiras equipes enfrentam
    "ninguém" e avançam direto — no máximo uma equipe sem jogo por confronto."""
    if len(teams) < 2:
        return []
    size = 2 ** math.ceil(math.log2(len(teams)))
    slots: list[str | None] = [*teams, *([None] * (size - len(teams)))]
    return [(slots[i], slots[size - 1 - i]) for i in range(size // 2)]


def _round_name(rounds_total: int, round_number: int) -> str:
    remaining = rounds_total - round_number
    return {0: "Final", 1: "Semifinal", 2: "Quartas de final", 3: "Oitavas de final"}.get(
        remaining, f"Rodada {round_number}"
    )


def _build_out(admin, event: dict, details: dict, user_id: str) -> TournamentOut:
    team_rows = (
        admin.table("tournament_teams")
        .select("id,name,status,captain_id,created_at")
        .eq("tournament_id", event["id"])
        .neq("status", "canceled")
        .order("created_at")
        .execute()
        .data
    )
    my_rows = (
        admin.table("tournament_team_members")
        .select("team_id")
        .eq("tournament_id", event["id"])
        .eq("user_id", user_id)
        .neq("status", "declined")
        .execute()
        .data
    )
    my_team_id = my_rows[0]["team_id"] if my_rows else None
    names = _names(admin, [t["captain_id"] for t in team_rows] + [event.get("organizer_id")])
    team_names = {t["id"]: t["name"] for t in team_rows}

    phases = (
        admin.table("tournament_phases")
        .select("id")
        .eq("tournament_id", event["id"])
        .eq("format", "knockout")
        .order("position")
        .execute()
        .data
    )
    rounds: list[RoundOut] = []
    champion = None
    if phases:
        matches = (
            admin.table("tournament_matches")
            .select("*")
            .eq("phase_id", phases[0]["id"])
            .order("round")
            .order("position")
            .execute()
            .data
        )
        total = max((m["round"] for m in matches), default=0)

        def team(team_id: str | None) -> MatchTeamOut | None:
            return MatchTeamOut(id=team_id, name=team_names.get(team_id, "Equipe")) if team_id else None

        by_round: dict[int, list[MatchOut]] = {}
        for m in matches:
            by_round.setdefault(m["round"], []).append(
                MatchOut(
                    id=m["id"],
                    round=m["round"],
                    position=m["position"],
                    status=m["status"],
                    home=team(m["home_team_id"]),
                    away=team(m["away_team_id"]),
                    home_score=m["home_score"],
                    away_score=m["away_score"],
                    winner_team_id=m["winner_team_id"],
                )
            )
            if m["round"] == total and m["winner_team_id"]:
                champion = team(m["winner_team_id"])
        rounds = [
            RoundOut(round=r, name=_round_name(total, r), matches=by_round[r]) for r in sorted(by_round)
        ]

    return TournamentOut(
        id=event["id"],
        sport=sport_slug_for_id(event["sport_id"]),
        title=event["title"],
        description=event.get("description"),
        location=event["location_name"],
        latitude=event["latitude"],
        longitude=event["longitude"],
        starts_at=event["starts_at"],
        status=event["status"],
        visibility=event["visibility"],
        organizer_id=event.get("organizer_id"),
        organizer_name=names.get(event.get("organizer_id"), ""),
        is_organizer=event.get("organizer_id") == user_id,
        max_teams=details["max_teams"],
        confirmed_teams=sum(1 for t in team_rows if t["status"] == "confirmed"),
        players_per_team_min=details["players_per_team_min"],
        players_per_team_max=details["players_per_team_max"],
        prize_description=details.get("prize_description"),
        requires_approval=bool(event.get("requires_approval")),
        teams=[
            TournamentTeamOut(
                id=t["id"],
                name=t["name"],
                status=t["status"],
                captain_id=t["captain_id"],
                captain_name=names.get(t["captain_id"], ""),
                is_mine=t["id"] == my_team_id,
            )
            for t in team_rows
            if t["status"] != "rejected" or t["id"] == my_team_id
        ],
        my_team_id=my_team_id,
        rounds=rounds,
        champion=champion,
    )


def _get_visible(admin, tournament_id: str, user_id: str) -> tuple[dict, dict]:
    event, details = _tournament_rows(admin, tournament_id)
    if event["visibility"] == "private" and event.get("organizer_id") != user_id:
        member = (
            admin.table("tournament_team_members")
            .select("team_id")
            .eq("tournament_id", tournament_id)
            .eq("user_id", user_id)
            .execute()
            .data
        )
        if not member:
            raise HTTPException(status_code=404, detail="Torneio não encontrado.")
    return event, details


@router.post("", response_model=TournamentOut, status_code=status.HTTP_201_CREATED)
def create_tournament(payload: TournamentCreate, token: str = Depends(bearer_token)) -> TournamentOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    sport_id = sport_id_for_slug(payload.sport)
    if sport_id is None:
        raise HTTPException(status_code=400, detail="Esporte inválido")
    _ensure_tournament_plan(admin, user)

    try:
        result = (
            get_user_scoped_client(token)
            .rpc(
                "create_tournament_event",
                {
                    "p_sport_id": sport_id,
                    "p_title": payload.title,
                    "p_description": payload.description,
                    "p_location": payload.location,
                    "p_latitude": payload.latitude,
                    "p_longitude": payload.longitude,
                    "p_starts_at": payload.starts_at.isoformat(),
                    "p_max_teams": payload.max_teams,
                    "p_players_min": payload.players_per_team_min,
                    "p_players_max": payload.players_per_team_max,
                    "p_prize": payload.prize_description,
                    "p_visibility": payload.visibility,
                },
            )
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        if "create_tournament_event" in str(exc) and (
            "Could not find" in str(exc) or "PGRST202" in str(exc)
        ):
            raise HTTPException(
                status_code=503,
                detail="Torneios ainda não estão ativos no banco: aplique a migration 0010_tournament_api.sql.",
            ) from exc
        raise _translate(exc, "Não foi possível criar o torneio") from exc

    tournament_id = result.data
    event, details = _tournament_rows(admin, tournament_id)
    return _build_out(admin, event, details, user.id)


@router.get("/{tournament_id}", response_model=TournamentOut)
def get_tournament(tournament_id: str, token: str = Depends(bearer_token)) -> TournamentOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    event, details = _get_visible(admin, tournament_id, user.id)
    return _build_out(admin, event, details, user.id)


@router.post("/{tournament_id}/teams", response_model=TournamentOut)
def register_team(
    tournament_id: str, payload: TeamRegister, token: str = Depends(bearer_token)
) -> TournamentOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    _get_visible(admin, tournament_id, user.id)
    try:
        get_user_scoped_client(token).rpc(
            "register_tournament_team", {"p_event_id": tournament_id, "p_name": payload.name}
        ).execute()
    except Exception as exc:  # noqa: BLE001
        raise _translate(exc, "Não foi possível inscrever a equipe") from exc
    event, details = _tournament_rows(admin, tournament_id)
    return _build_out(admin, event, details, user.id)


@router.post("/teams/{team_id}/cancel", response_model=TournamentOut)
def cancel_team(team_id: str, token: str = Depends(bearer_token)) -> TournamentOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    rows = admin.table("tournament_teams").select("tournament_id").eq("id", team_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    try:
        get_user_scoped_client(token).rpc("cancel_team", {"p_team_id": team_id}).execute()
    except Exception as exc:  # noqa: BLE001
        raise _translate(exc, "Não foi possível cancelar a inscrição da equipe") from exc
    event, details = _tournament_rows(admin, rows[0]["tournament_id"])
    return _build_out(admin, event, details, user.id)


@router.post("/teams/{team_id}/decision", response_model=TournamentOut)
def decide_team(
    team_id: str, payload: TeamDecision, token: str = Depends(bearer_token)
) -> TournamentOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    rows = admin.table("tournament_teams").select("tournament_id").eq("id", team_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    try:
        get_user_scoped_client(token).rpc(
            "decide_team", {"p_team_id": team_id, "p_approve": payload.approve}
        ).execute()
    except Exception as exc:  # noqa: BLE001
        raise _translate(exc, "Não foi possível decidir sobre a equipe") from exc
    event, details = _tournament_rows(admin, rows[0]["tournament_id"])
    return _build_out(admin, event, details, user.id)


@router.post("/{tournament_id}/bracket", response_model=TournamentOut)
def generate_bracket(tournament_id: str, token: str = Depends(bearer_token)) -> TournamentOut:
    """Gera (ou refaz) o chaveamento mata-mata com as equipes confirmadas, em
    ordem sorteada. Quando o número de equipes não é potência de 2, as
    primeiras do sorteio passam direto para a 2ª rodada (bye)."""
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    event, details = _tournament_rows(admin, tournament_id)
    if event.get("organizer_id") != user.id:
        raise HTTPException(status_code=403, detail="Só o organizador gera o chaveamento.")
    if event["status"] in ("finished", "canceled"):
        raise HTTPException(status_code=400, detail="Este torneio já terminou ou foi cancelado.")

    teams = [
        t["id"]
        for t in admin.table("tournament_teams")
        .select("id")
        .eq("tournament_id", tournament_id)
        .eq("status", "confirmed")
        .execute()
        .data
    ]
    if len(teams) < 2:
        raise HTTPException(status_code=400, detail="É preciso de pelo menos 2 equipes confirmadas.")
    random.shuffle(teams)

    rounds_total = math.ceil(math.log2(len(teams)))
    size = 2**rounds_total

    # Refazer apaga o chaveamento anterior (as partidas saem junto, em cascata).
    admin.table("tournament_phases").delete().eq("tournament_id", tournament_id).execute()
    phase = (
        admin.table("tournament_phases")
        .insert(
            {"tournament_id": tournament_id, "position": 1, "name": "Mata-mata", "format": "knockout"}
        )
        .execute()
        .data[0]
    )

    def insert_match(round_number: int, position: int, next_id=None, slot=None, home=None, away=None):
        return (
            admin.table("tournament_matches")
            .insert(
                {
                    "tournament_id": tournament_id,
                    "phase_id": phase["id"],
                    "round": round_number,
                    "position": position,
                    "next_match_id": next_id,
                    "next_match_slot": slot,
                    "home_team_id": home,
                    "away_team_id": away,
                }
            )
            .execute()
            .data[0]["id"]
        )

    # Da final para trás, cada partida aponta para a seguinte (o trigger do
    # banco leva o vencedor para lá). A rodada 1 fica para o fim, com as equipes.
    ids: dict[tuple[int, int], str] = {}
    for r in range(rounds_total, 1, -1):
        for p in range(1, size // 2**r + 1):
            next_id = ids.get((r + 1, (p + 1) // 2))
            slot = None if next_id is None else ("home" if p % 2 == 1 else "away")
            ids[(r, p)] = insert_match(r, p, next_id, slot)

    for index, (home, away) in enumerate(first_round_pairs(teams), start=1):
        next_id = ids.get((2, (index + 1) // 2))
        slot = None if next_id is None else ("home" if index % 2 == 1 else "away")
        if home and away:
            insert_match(1, index, next_id, slot, home, away)
        elif next_id:
            # Bye: a equipe já entra na partida da 2ª rodada.
            admin.table("tournament_matches").update({f"{slot}_team_id": home or away}).eq(
                "id", next_id
            ).execute()

    event, details = _tournament_rows(admin, tournament_id)
    return _build_out(admin, event, details, user.id)


@router.patch("/{tournament_id}/matches/{match_id}", response_model=TournamentOut)
def record_result(
    tournament_id: str, match_id: str, payload: MatchResult, token: str = Depends(bearer_token)
) -> TournamentOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    event, _details = _tournament_rows(admin, tournament_id)
    if event.get("organizer_id") != user.id:
        raise HTTPException(status_code=403, detail="Só o organizador lança resultados.")

    rows = (
        admin.table("tournament_matches")
        .select("*")
        .eq("id", match_id)
        .eq("tournament_id", tournament_id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Partida não encontrada.")
    match = rows[0]
    if not match["home_team_id"] or not match["away_team_id"]:
        raise HTTPException(status_code=400, detail="A partida ainda não tem as duas equipes definidas.")
    if match["next_match_id"]:
        nxt = (
            admin.table("tournament_matches").select("status").eq("id", match["next_match_id"]).execute().data
        )
        if nxt and nxt[0]["status"] in ("finished", "walkover"):
            raise HTTPException(
                status_code=400, detail="A partida seguinte já foi jogada; não dá para mudar este placar."
            )

    winner = payload.winner_team_id
    if payload.home_score != payload.away_score:
        winner = None  # o banco define pelo placar
    elif winner not in (match["home_team_id"], match["away_team_id"]):
        raise HTTPException(status_code=400, detail="Empate no mata-mata: escolha quem avança.")

    try:
        admin.table("tournament_matches").update(
            {
                "status": "finished",
                "home_score": payload.home_score,
                "away_score": payload.away_score,
                "winner_team_id": winner,
            }
        ).eq("id", match_id).execute()
    except Exception as exc:  # noqa: BLE001
        raise _translate(exc, "Não foi possível salvar o resultado") from exc

    event, details = _tournament_rows(admin, tournament_id)
    return _build_out(admin, event, details, user.id)
