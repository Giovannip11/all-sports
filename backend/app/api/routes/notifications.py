from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import authenticated_user, bearer_token
from app.core.supabase import get_supabase_admin_client
from app.schemas.notifications import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _notification_out(row: dict) -> NotificationOut:
    return NotificationOut(
        id=row["id"],
        event_id=row.get("event_id"),
        type=row["type"],
        title=row.get("title"),
        message=row["message"],
        read=row.get("read_at") is not None,
        created_at=row["created_at"],
    )


@router.get("", response_model=list[NotificationOut])
def list_notifications(token: str = Depends(bearer_token)) -> list[NotificationOut]:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    rows = (
        admin.table("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
        .data
    )
    return [_notification_out(row) for row in rows]


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: str, token: str = Depends(bearer_token)) -> NotificationOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    rows = (
        admin.table("notifications")
        .update({"read_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", notification_id)
        .eq("user_id", user.id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    return _notification_out(rows[0])


@router.post("/read-all", response_model=dict)
def mark_all_read(token: str = Depends(bearer_token)) -> dict:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    admin.table("notifications").update(
        {"read_at": datetime.now(timezone.utc).isoformat()}
    ).eq("user_id", user.id).is_("read_at", "null").execute()
    return {"ok": True}
