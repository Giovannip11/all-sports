from fastapi import APIRouter, Depends, HTTPException

from app.core.security import authenticated_user, bearer_token
from app.core.supabase import get_supabase_admin_client
from app.schemas.notifications import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


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
    return [NotificationOut(**row) for row in rows]


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: str, token: str = Depends(bearer_token)) -> NotificationOut:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    rows = (
        admin.table("notifications")
        .update({"read": True})
        .eq("id", notification_id)
        .eq("user_id", user.id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    return NotificationOut(**rows[0])


@router.post("/read-all", response_model=dict)
def mark_all_read(token: str = Depends(bearer_token)) -> dict:
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    admin.table("notifications").update({"read": True}).eq("user_id", user.id).eq(
        "read", False
    ).execute()
    return {"ok": True}
