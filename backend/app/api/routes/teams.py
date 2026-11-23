import random

from fastapi import APIRouter, Depends, HTTPException

from app.api.routes.events import (
    _ensure_organizer_plan,
    _get_event_row,
    _joined_event_ids,
)
from app.core.security import authenticated_user, bearer_token
from app.core.supabase import get_supabase_admin_client
from app.schemas.teams import TeamDrawOut, TeamDrawRequest, TeamMemberOut, TeamOut

router = APIRouter(prefix="/events", tags=["teams"])


def _events_played_counts(admin, user_ids: list[str]) -> dict[str, int]:
    """How many events each user has a confirmed registration in — the
    stand-in "skill" signal for balanced draws until there's a real rating."""
    if not user_ids:
        return {}
    rows = (
        admin.table("event_registrations")
        .select("user_id")
        .in_("user_id", user_ids)
        .eq("status", "confirmed")
        .execute()
        .data
    )
    counts = {uid: 0 for uid in user_ids}
    for row in rows:
        counts[row["user_id"]] = counts.get(row["user_id"], 0) + 1
    return counts


def _names_for(admin, user_ids: list[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    rows = admin.table("profiles").select("id,name").in_("id", user_ids).execute().data
    return {row["id"]: row["name"] for row in rows}


def _assign_snake(ordered_user_ids: list[str], team_count: int) -> list[list[str]]:
    """Same distribution the DB's `draw_event_teams` RPC uses: round-robin
    across teams, reversing direction every full pass so a sorted-by-skill
    list comes out balanced instead of front-loading the strongest team."""
    teams: list[list[str]] = [[] for _ in range(team_count)]
    for i, user_id in enumerate(ordered_user_ids):
        team = i % team_count
        if (i // team_count) % 2 == 1:
            team = team_count - 1 - team
        teams[team].append(user_id)
    return teams


def _build_draw_out(admin, draw: dict, team_rows: list[dict], teams: list[list[str]]) -> TeamDrawOut:
    all_members = [uid for team in teams for uid in team]
    names = _names_for(admin, all_members)
    counts = _events_played_counts(admin, all_members)

    return TeamDrawOut(
        id=draw["id"],
        mode=draw["mode"],
        team_count=draw["team_count"],
        created_at=draw["created_at"],
        teams=[
            TeamOut(
                id=team_row["id"],
                name=team_row["name"],
                position=team_row["position"],
                members=[
                    TeamMemberOut(
                        user_id=uid, name=names.get(uid, ""), events_played=counts.get(uid, 0)
                    )
                    for uid in team
                ],
            )
            for team_row, team in zip(team_rows, teams)
        ],
    )


def _current_draw(admin, event_id: str) -> tuple[dict, list[dict]] | None:
    draws = (
        admin.table("event_team_draws")
        .select("*")
        .eq("event_id", event_id)
        .eq("is_current", True)
        .execute()
        .data
    )
    if not draws:
        return None
    draw = draws[0]
    team_rows = (
        admin.table("event_teams")
        .select("*")
        .eq("draw_id", draw["id"])
        .order("position")
        .execute()
        .data
    )
    return draw, team_rows


@router.get("/{event_id}/teams", response_model=TeamDrawOut)
def get_teams(event_id: str, token: str = Depends(bearer_token)) -> TeamDrawOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    row = _get_event_row(admin, event_id)

    joined_ids = _joined_event_ids(admin, user.id)
    if row["organizer_id"] != user.id and event_id not in joined_ids:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    current = _current_draw(admin, event_id)
    if not current:
        raise HTTPException(status_code=404, detail="Nenhum sorteio de times feito ainda")
    draw, team_rows = current

    members_by_team = (
        admin.table("event_team_members")
        .select("team_id,user_id")
        .eq("draw_id", draw["id"])
        .execute()
        .data
    )
    teams: list[list[str]] = []
    for team_row in team_rows:
        teams.append(
            [m["user_id"] for m in members_by_team if m["team_id"] == team_row["id"]]
        )

    return _build_draw_out(admin, draw, team_rows, teams)


@router.post("/{event_id}/teams/draw", response_model=TeamDrawOut)
def draw_teams(
    event_id: str, payload: TeamDrawRequest, token: str = Depends(bearer_token)
) -> TeamDrawOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    row = _get_event_row(admin, event_id)

    if row["organizer_id"] != user.id:
        raise HTTPException(status_code=403, detail="Só o organizador pode sortear os times")
    if row["kind"] == "tournament":
        raise HTTPException(
            status_code=400, detail="Torneios usam o chaveamento próprio, não sorteio de times"
        )
    if row["status"] not in ("open", "full", "in_progress"):
        raise HTTPException(status_code=400, detail="O evento precisa estar aberto")

    _ensure_organizer_plan(admin, user.id)

    participant_rows = (
        admin.table("event_registrations")
        .select("user_id")
        .eq("event_id", event_id)
        .eq("status", "confirmed")
        .execute()
        .data
    )
    user_ids = [p["user_id"] for p in participant_rows]
    if len(user_ids) < payload.team_count:
        raise HTTPException(
            status_code=400,
            detail=f"É preciso de pelo menos {payload.team_count} participantes confirmados",
        )

    if payload.mode == "balanced":
        counts = _events_played_counts(admin, user_ids)
        ordered = sorted(user_ids, key=lambda uid: counts[uid], reverse=True)
    else:
        ordered = user_ids[:]
        random.shuffle(ordered)

    teams = _assign_snake(ordered, payload.team_count)

    admin.table("event_team_draws").update({"is_current": False}).eq(
        "event_id", event_id
    ).eq("is_current", True).execute()
    draw = (
        admin.table("event_team_draws")
        .insert(
            {
                "event_id": event_id,
                "created_by": user.id,
                "mode": payload.mode,
                "team_count": payload.team_count,
            }
        )
        .execute()
        .data[0]
    )

    team_rows = [
        admin.table("event_teams")
        .insert({"draw_id": draw["id"], "name": f"Time {i + 1}", "position": i + 1})
        .execute()
        .data[0]
        for i in range(payload.team_count)
    ]

    members_payload = [
        {"team_id": team_row["id"], "draw_id": draw["id"], "user_id": uid}
        for team_row, team in zip(team_rows, teams)
        for uid in team
    ]
    if members_payload:
        admin.table("event_team_members").insert(members_payload).execute()

    return _build_draw_out(admin, draw, team_rows, teams)
