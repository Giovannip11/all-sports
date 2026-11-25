from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import authenticated_user, bearer_token
from app.core.sports import sport_id_for_slug, sport_slug_for_id
from app.core.supabase import get_supabase_admin_client, get_user_scoped_client
from app.schemas.events import EventCreate, EventDetailOut, EventOut, EventUpdate, ParticipantOut

router = APIRouter(prefix="/events", tags=["events"])

# A pickup game/racha doesn't collect an end time in the UI — default to a
# typical 2h slot so the (required) `ends_at` column is always sane.
DEFAULT_DURATION = timedelta(hours=2)


def _ensure_organizer_plan(admin, user_id: str) -> None:
    """The real `plans`/`subscriptions` schema only allows creating events from
    tier >= 1 ("casual") — every signup starts on the free plan (tier 0), which
    can't. Until there's a real upgrade/billing flow, silently grant "casual"
    the first time an organizer account tries to create an event."""
    casual = admin.table("plans").select("id").eq("code", "casual").execute().data[0]
    current = (
        admin.table("subscriptions")
        .select("id,plan_id")
        .eq("user_id", user_id)
        .in_("status", ["trialing", "active", "past_due"])
        .execute()
        .data
    )
    # Já em Casual ou acima (ids crescem com o tier): não rebaixa quem está no
    # Intermediário/Arena — antes, criar um racha voltava a assinatura para Casual.
    if current and current[0]["plan_id"] >= casual["id"]:
        return
    if current:
        admin.table("subscriptions").update({"plan_id": casual["id"]}).eq(
            "id", current[0]["id"]
        ).execute()
    else:
        admin.table("subscriptions").insert(
            {"user_id": user_id, "plan_id": casual["id"]}
        ).execute()


def _organizer_name(admin, organizer_id: str | None) -> str:
    if not organizer_id:
        return ""
    rows = admin.table("profiles").select("name").eq("id", organizer_id).execute().data
    return rows[0]["name"] if rows else ""


def event_capacity(admin, row: dict) -> int:
    """Vagas do evento. Torneios não têm max_participants: a capacidade é o
    número máximo de equipes (tabela tournaments)."""
    if row.get("max_participants") is not None:
        return row["max_participants"]
    rows = (
        admin.table("tournaments").select("max_teams").eq("event_id", row["id"]).execute().data
    )
    return rows[0]["max_teams"] if rows else 0


def _event_out(row: dict, admin, joined_ids: set[str], user_id: str) -> EventOut:
    return EventOut(
        id=row["id"],
        kind=row.get("kind", "pickup"),
        organizer_id=row["organizer_id"],
        organizer_name=_organizer_name(admin, row["organizer_id"]),
        sport=sport_slug_for_id(row["sport_id"]),
        title=row["title"],
        description=row.get("description"),
        location=row["location_name"],
        latitude=row["latitude"],
        longitude=row["longitude"],
        starts_at=row["starts_at"],
        max_participants=event_capacity(admin, row),
        visibility=row["visibility"],
        status=row["status"],
        participants_count=row["confirmed_count"],
        is_participant=row["id"] in joined_ids,
        is_organizer=row["organizer_id"] == user_id,
        created_at=row["created_at"],
    )


def _joined_event_ids(admin, user_id: str) -> set[str]:
    rows = (
        admin.table("event_registrations")
        .select("event_id")
        .eq("user_id", user_id)
        .in_("status", ["confirmed", "waitlisted"])
        .execute()
        .data
    )
    return {row["event_id"] for row in rows}


def _visible_events_for(admin, user_id: str, sport: str | None = None) -> list[dict]:
    """Public, open-for-discovery events, plus ones the user organizes or has
    joined — the same visibility rule used for the events list and the map."""
    public_query = (
        admin.table("events")
        .select("*")
        .eq("visibility", "public")
        .in_("status", ["open", "full", "in_progress"])
    )
    if sport:
        sport_id = sport_id_for_slug(sport)
        if sport_id is None:
            return []
        public_query = public_query.eq("sport_id", sport_id)
    public_rows = public_query.execute().data

    own_rows = admin.table("events").select("*").eq("organizer_id", user_id).execute().data

    joined_ids = _joined_event_ids(admin, user_id)
    joined_rows: list[dict] = []
    if joined_ids:
        joined_rows = admin.table("events").select("*").in_("id", list(joined_ids)).execute().data

    by_id = {row["id"]: row for row in [*public_rows, *own_rows, *joined_rows]}
    return list(by_id.values())


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, token: str = Depends(bearer_token)) -> EventOut:
    user = authenticated_user(token)
    metadata = user.user_metadata or {}

    if metadata.get("role") != "organize":
        raise HTTPException(
            status_code=403,
            detail="Só contas de organizador podem criar eventos. Troque o tipo de conta no perfil.",
        )

    sport_id = sport_id_for_slug(payload.sport)
    if sport_id is None:
        raise HTTPException(status_code=400, detail="Esporte inválido")

    admin = get_supabase_admin_client()
    _ensure_organizer_plan(admin, user.id)
    starts_at = payload.starts_at
    try:
        row = (
            admin.table("events")
            .insert(
                {
                    "organizer_id": user.id,
                    "sport_id": sport_id,
                    "title": payload.title,
                    "description": payload.description,
                    "location_name": payload.location,
                    "latitude": payload.latitude,
                    "longitude": payload.longitude,
                    "starts_at": starts_at.isoformat(),
                    "ends_at": (starts_at + DEFAULT_DURATION).isoformat(),
                    "max_participants": payload.max_participants,
                    "visibility": payload.visibility,
                    "status": "open",
                }
            )
            .execute()
            .data[0]
        )
    except Exception as exc:  # noqa: BLE001 - supabase-py wraps PostgREST errors generically
        message = str(exc)
        if "profiles" in message and ("violates foreign key" in message or "23503" in message):
            raise HTTPException(
                status_code=400,
                detail="Seu perfil precisa ser recriado — saia e crie a conta de novo.",
            ) from exc
        if "starts_in_past" in message:
            raise HTTPException(
                status_code=400, detail="A data do evento precisa ser no futuro"
            ) from exc
        raise HTTPException(status_code=400, detail="Não foi possível criar o evento") from exc

    return _event_out(row, admin, joined_ids={row["id"]}, user_id=user.id)


@router.get("", response_model=list[EventOut])
def list_events(sport: str | None = None, token: str = Depends(bearer_token)) -> list[EventOut]:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    rows = _visible_events_for(admin, user.id, sport)
    joined_ids = _joined_event_ids(admin, user.id)

    events = [_event_out(row, admin, joined_ids, user.id) for row in rows]
    events.sort(key=lambda e: e.starts_at)
    return events


@router.get("/me/history", response_model=list[EventOut])
def my_event_history(token: str = Depends(bearer_token)) -> list[EventOut]:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    joined_ids = _joined_event_ids(admin, user.id)
    if not joined_ids:
        return []

    rows = admin.table("events").select("*").in_("id", list(joined_ids)).execute().data
    events = [_event_out(row, admin, joined_ids, user.id) for row in rows]
    events.sort(key=lambda e: e.starts_at, reverse=True)
    return events


def _get_event_row(admin, event_id: str) -> dict:
    rows = admin.table("events").select("*").eq("id", event_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return rows[0]


def _assert_can_view(row: dict, user_id: str, joined_ids: set[str]) -> None:
    if row["visibility"] == "public":
        return
    if row["organizer_id"] == user_id or row["id"] in joined_ids:
        return
    raise HTTPException(status_code=404, detail="Evento não encontrado")


@router.get("/{event_id}", response_model=EventDetailOut)
def get_event(event_id: str, token: str = Depends(bearer_token)) -> EventDetailOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    row = _get_event_row(admin, event_id)
    joined_ids = _joined_event_ids(admin, user.id)
    _assert_can_view(row, user.id, joined_ids)

    participant_rows = (
        admin.table("event_registrations")
        .select("user_id,status,presence_confirmed_at,created_at")
        .eq("event_id", event_id)
        .in_("status", ["confirmed", "waitlisted"])
        .execute()
        .data
    )
    participants = []
    for p in participant_rows:
        name_rows = admin.table("profiles").select("name").eq("id", p["user_id"]).execute().data
        participants.append(
            ParticipantOut(
                user_id=p["user_id"],
                name=name_rows[0]["name"] if name_rows else "",
                status=p["status"],
                presence_confirmed=p["presence_confirmed_at"] is not None,
                joined_at=p["created_at"],
            )
        )

    base = _event_out(row, admin, joined_ids, user.id)
    return EventDetailOut(**base.model_dump(), participants=participants)


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str, payload: EventUpdate, token: str = Depends(bearer_token)
) -> EventOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    row = _get_event_row(admin, event_id)
    if row["organizer_id"] != user.id:
        raise HTTPException(status_code=403, detail="Só o organizador pode editar este evento")

    patch = payload.model_dump(exclude_none=True, exclude={"location"}, mode="json")
    if payload.location is not None:
        patch["location_name"] = payload.location
    # O fim (obrigatório no banco) acompanha a nova data, mantendo a duração padrão.
    if payload.starts_at is not None:
        patch["ends_at"] = (payload.starts_at + DEFAULT_DURATION).isoformat()
    if payload.max_participants is not None and payload.max_participants < row["confirmed_count"]:
        raise HTTPException(
            status_code=400,
            detail=f"Já há {row['confirmed_count']} inscritos; as vagas não podem ser menos que isso",
        )
    if not patch:
        joined_ids = _joined_event_ids(admin, user.id)
        return _event_out(row, admin, joined_ids, user.id)

    try:
        updated = admin.table("events").update(patch).eq("id", event_id).execute().data[0]
    except Exception as exc:  # noqa: BLE001
        if "starts_in_past" in str(exc):
            raise HTTPException(
                status_code=400, detail="A data do evento precisa ser no futuro"
            ) from exc
        raise HTTPException(status_code=400, detail="Não foi possível atualizar o evento") from exc

    joined_ids = _joined_event_ids(admin, user.id)
    return _event_out(updated, admin, joined_ids, user.id)


def _translate_rpc_error(message: str) -> HTTPException:
    if "event_full" in message:
        return HTTPException(status_code=409, detail="Evento lotado")
    if "event_not_found" in message:
        return HTTPException(status_code=404, detail="Evento não encontrado")
    if "event_not_open" in message or "event_finished" in message:
        return HTTPException(status_code=400, detail="Este evento não está aberto para inscrição")
    if "profile_incomplete" in message:
        return HTTPException(
            status_code=400,
            detail="Complete seu perfil (data de nascimento e gênero) antes de entrar em um evento.",
        )
    if "plan_required" in message:
        return HTTPException(
            status_code=403, detail="Seu plano atual não permite essa ação"
        )
    if "not_registered" in message:
        return HTTPException(status_code=400, detail="Você não está inscrito neste evento")
    return HTTPException(status_code=400, detail="Não foi possível completar a ação")


@router.post("/{event_id}/join", response_model=EventOut)
def join_event(event_id: str, token: str = Depends(bearer_token)) -> EventOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    row = _get_event_row(admin, event_id)

    user_client = get_user_scoped_client(token)
    try:
        user_client.rpc("join_event", {"p_event_id": event_id}).execute()
    except Exception as exc:  # noqa: BLE001
        raise _translate_rpc_error(str(exc)) from exc

    updated = _get_event_row(admin, event_id)
    joined_ids = _joined_event_ids(admin, user.id)
    return _event_out(updated, admin, joined_ids, user.id)


@router.post("/{event_id}/leave", response_model=EventOut)
def leave_event(event_id: str, token: str = Depends(bearer_token)) -> EventOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    row = _get_event_row(admin, event_id)

    user_client = get_user_scoped_client(token)
    try:
        user_client.rpc("leave_event", {"p_event_id": event_id}).execute()
    except Exception as exc:  # noqa: BLE001
        raise _translate_rpc_error(str(exc)) from exc

    updated = _get_event_row(admin, event_id)
    joined_ids = _joined_event_ids(admin, user.id)
    return _event_out(updated, admin, joined_ids, user.id)


@router.post("/{event_id}/presence", response_model=EventOut)
def confirm_presence(event_id: str, token: str = Depends(bearer_token)) -> EventOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()
    row = _get_event_row(admin, event_id)

    user_client = get_user_scoped_client(token)
    try:
        user_client.rpc("confirm_presence", {"p_event_id": event_id}).execute()
    except Exception as exc:  # noqa: BLE001
        raise _translate_rpc_error(str(exc)) from exc

    joined_ids = _joined_event_ids(admin, user.id)
    return _event_out(row, admin, joined_ids, user.id)
