from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import authenticated_user, bearer_token
from app.core.supabase import get_supabase_admin_client
from app.schemas.events import EventCreate, EventDetailOut, EventOut, EventUpdate, ParticipantOut

router = APIRouter(prefix="/events", tags=["events"])


def _event_out(row: dict, participants_count: int, joined_ids: set[str], user_id: str) -> EventOut:
    return EventOut(
        id=row["id"],
        organizer_id=row["organizer_id"],
        organizer_name=row["organizer_name"],
        sport=row["sport"],
        title=row["title"],
        description=row.get("description"),
        location=row["location"],
        latitude=row["latitude"],
        longitude=row["longitude"],
        starts_at=row["starts_at"],
        max_participants=row["max_participants"],
        visibility=row["visibility"],
        status=row["status"],
        participants_count=participants_count,
        is_participant=row["id"] in joined_ids,
        is_organizer=row["organizer_id"] == user_id,
        created_at=row["created_at"],
    )


def _counts_for(admin, event_ids: list[str]) -> dict[str, int]:
    if not event_ids:
        return {}
    rows = (
        admin.table("event_participants")
        .select("event_id")
        .in_("event_id", event_ids)
        .eq("status", "confirmed")
        .execute()
        .data
    )
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["event_id"]] = counts.get(row["event_id"], 0) + 1
    return counts


def _joined_event_ids(admin, user_id: str) -> set[str]:
    rows = (
        admin.table("event_participants")
        .select("event_id")
        .eq("user_id", user_id)
        .eq("status", "confirmed")
        .execute()
        .data
    )
    return {row["event_id"] for row in rows}


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, token: str = Depends(bearer_token)) -> EventOut:
    user = authenticated_user(token)
    metadata = user.user_metadata or {}

    if metadata.get("role") != "organize":
        raise HTTPException(
            status_code=403,
            detail="Só contas de organizador podem criar eventos. Troque o tipo de conta no perfil.",
        )

    admin = get_supabase_admin_client()
    row = (
        admin.table("events")
        .insert(
            {
                "organizer_id": user.id,
                "organizer_name": metadata.get("name", ""),
                **payload.model_dump(mode="json"),
            }
        )
        .execute()
        .data[0]
    )
    return _event_out(row, participants_count=0, joined_ids=set(), user_id=user.id)


def _visible_events_for(admin, user_id: str, sport: str | None = None) -> list[dict]:
    """Public active events (optionally filtered by sport), plus events the
    user organizes or has joined — the same visibility rule used for the
    events list and the map markers."""
    public_query = (
        admin.table("events").select("*").eq("visibility", "public").eq("status", "active")
    )
    if sport:
        public_query = public_query.eq("sport", sport)
    public_rows = public_query.execute().data

    own_rows = admin.table("events").select("*").eq("organizer_id", user_id).execute().data

    joined_ids = _joined_event_ids(admin, user_id)
    joined_rows: list[dict] = []
    if joined_ids:
        joined_rows = admin.table("events").select("*").in_("id", list(joined_ids)).execute().data

    by_id = {row["id"]: row for row in [*public_rows, *own_rows, *joined_rows]}
    return list(by_id.values())


@router.get("", response_model=list[EventOut])
def list_events(sport: str | None = None, token: str = Depends(bearer_token)) -> list[EventOut]:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    rows = _visible_events_for(admin, user.id, sport)
    joined_ids = _joined_event_ids(admin, user.id)
    counts = _counts_for(admin, [row["id"] for row in rows])

    events = [_event_out(row, counts.get(row["id"], 0), joined_ids, user.id) for row in rows]
    events.sort(key=lambda e: e.starts_at)
    return events


@router.get("/me/history", response_model=list[EventOut])
def my_event_history(token: str = Depends(bearer_token)) -> list[EventOut]:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    participations = (
        admin.table("event_participants").select("event_id").eq("user_id", user.id).execute().data
    )
    event_ids = [row["event_id"] for row in participations]
    if not event_ids:
        return []

    rows = admin.table("events").select("*").in_("id", event_ids).execute().data
    joined_ids = _joined_event_ids(admin, user.id)
    counts = _counts_for(admin, event_ids)

    events = [_event_out(row, counts.get(row["id"], 0), joined_ids, user.id) for row in rows]
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
        admin.table("event_participants")
        .select("user_id,status,presence_confirmed,joined_at")
        .eq("event_id", event_id)
        .eq("status", "confirmed")
        .execute()
        .data
    )
    participants = []
    for p in participant_rows:
        try:
            p_user = admin.auth.admin.get_user_by_id(p["user_id"]).user
            name = (p_user.user_metadata or {}).get("name", "") if p_user else ""
        except Exception:
            name = ""
        participants.append(
            ParticipantOut(
                user_id=p["user_id"],
                name=name,
                status=p["status"],
                presence_confirmed=p["presence_confirmed"],
                joined_at=p["joined_at"],
            )
        )

    base = _event_out(row, len(participants), joined_ids, user.id)
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

    patch = payload.model_dump(exclude_none=True, mode="json")
    if not patch:
        joined_ids = _joined_event_ids(admin, user.id)
        counts = _counts_for(admin, [event_id])
        return _event_out(row, counts.get(event_id, 0), joined_ids, user.id)

    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated = (
        admin.table("events").update(patch).eq("id", event_id).execute().data[0]
    )

    is_cancelling = patch.get("status") == "cancelled" and row["status"] != "cancelled"
    notable_change = is_cancelling or any(k in patch for k in ("starts_at", "location"))
    if notable_change:
        message = (
            f'O evento "{row["title"]}" foi cancelado pelo organizador.'
            if is_cancelling
            else f'O evento "{row["title"]}" foi atualizado pelo organizador.'
        )
        _notify_participants(admin, event_id, "event_cancelled" if is_cancelling else "event_updated", message)

    joined_ids = _joined_event_ids(admin, user.id)
    counts = _counts_for(admin, [event_id])
    return _event_out(updated, counts.get(event_id, 0), joined_ids, user.id)


def _notify_participants(admin, event_id: str, notif_type: str, message: str) -> None:
    participants = (
        admin.table("event_participants")
        .select("user_id")
        .eq("event_id", event_id)
        .eq("status", "confirmed")
        .execute()
        .data
    )
    if not participants:
        return
    admin.table("notifications").insert(
        [
            {
                "user_id": p["user_id"],
                "event_id": event_id,
                "type": notif_type,
                "message": message,
            }
            for p in participants
        ]
    ).execute()


@router.post("/{event_id}/join", response_model=EventOut)
def join_event(event_id: str, token: str = Depends(bearer_token)) -> EventOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    row = _get_event_row(admin, event_id)
    if row["visibility"] != "public" and row["organizer_id"] != user.id:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    try:
        admin.rpc("join_event", {"p_event_id": event_id, "p_user_id": user.id}).execute()
    except Exception as exc:  # noqa: BLE001 - supabase-py wraps PostgREST errors generically
        message = str(exc)
        if "event_full" in message:
            raise HTTPException(status_code=409, detail="Evento lotado") from exc
        if "event_cancelled" in message:
            raise HTTPException(status_code=400, detail="Este evento foi cancelado") from exc
        if "event_not_found" in message:
            raise HTTPException(status_code=404, detail="Evento não encontrado") from exc
        raise HTTPException(status_code=400, detail="Não foi possível se inscrever") from exc

    joined_ids = _joined_event_ids(admin, user.id)
    counts = _counts_for(admin, [event_id])
    return _event_out(row, counts.get(event_id, 0), joined_ids, user.id)


@router.post("/{event_id}/leave", response_model=EventOut)
def leave_event(event_id: str, token: str = Depends(bearer_token)) -> EventOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    row = _get_event_row(admin, event_id)
    result = (
        admin.table("event_participants")
        .update({"status": "cancelled"})
        .eq("event_id", event_id)
        .eq("user_id", user.id)
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=400, detail="Você não está inscrito neste evento")

    joined_ids = _joined_event_ids(admin, user.id)
    counts = _counts_for(admin, [event_id])
    return _event_out(row, counts.get(event_id, 0), joined_ids, user.id)


@router.post("/{event_id}/presence", response_model=EventOut)
def confirm_presence(event_id: str, token: str = Depends(bearer_token)) -> EventOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    row = _get_event_row(admin, event_id)
    result = (
        admin.table("event_participants")
        .update({"presence_confirmed": True})
        .eq("event_id", event_id)
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .execute()
        .data
    )
    if not result:
        raise HTTPException(
            status_code=400, detail="Você precisa estar inscrito para confirmar presença"
        )

    joined_ids = _joined_event_ids(admin, user.id)
    counts = _counts_for(admin, [event_id])
    return _event_out(row, counts.get(event_id, 0), joined_ids, user.id)
