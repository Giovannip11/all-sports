from fastapi import APIRouter, Depends, HTTPException

from app.core.security import authenticated_user, bearer_token
from app.core.supabase import get_supabase_admin_client, get_user_scoped_client
from app.schemas.chat import MessageCreate, MessageOut

router = APIRouter(prefix="/events", tags=["chat"])

# Every event gets its own conversation automatically (DB trigger on event
# creation), and confirmed participants are added/removed as members
# automatically too — we only need to read/write messages here, and let RLS
# (via the user-scoped client) enforce who's allowed to see or post in it.


def _conversation_id_for(user_client, event_id: str) -> str:
    rows = user_client.table("conversations").select("id").eq("event_id", event_id).execute().data
    if not rows:
        raise HTTPException(
            status_code=404,
            detail="Chat não encontrado — você precisa estar inscrito no evento para acessá-lo.",
        )
    return rows[0]["id"]


def _names_for(admin, user_ids: list[str]) -> dict[str, str]:
    ids = [uid for uid in set(user_ids) if uid]
    if not ids:
        return {}
    rows = admin.table("profiles").select("id,name").in_("id", ids).execute().data
    return {row["id"]: row["name"] for row in rows}


@router.get("/{event_id}/messages", response_model=list[MessageOut])
def list_messages(event_id: str, token: str = Depends(bearer_token)) -> list[MessageOut]:
    user = authenticated_user(token)
    user_client = get_user_scoped_client(token)
    conversation_id = _conversation_id_for(user_client, event_id)

    rows = (
        user_client.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .is_("deleted_at", "null")
        .order("created_at")
        .limit(200)
        .execute()
        .data
    )

    admin = get_supabase_admin_client()
    names = _names_for(admin, [row["sender_id"] for row in rows])

    try:
        user_client.rpc("mark_conversation_read", {"p_conversation_id": conversation_id}).execute()
    except Exception:  # noqa: BLE001 - read-state sync is best-effort, never blocks the chat
        pass

    return [
        MessageOut(
            id=row["id"],
            sender_id=row["sender_id"],
            sender_name=names.get(row["sender_id"], "Participante"),
            body=row["body"],
            created_at=row["created_at"],
            is_mine=row["sender_id"] == user.id,
        )
        for row in rows
    ]


@router.post("/{event_id}/messages", response_model=MessageOut, status_code=201)
def send_message(
    event_id: str, payload: MessageCreate, token: str = Depends(bearer_token)
) -> MessageOut:
    user = authenticated_user(token)
    user_client = get_user_scoped_client(token)
    conversation_id = _conversation_id_for(user_client, event_id)

    try:
        row = (
            user_client.table("messages")
            .insert(
                {
                    "conversation_id": conversation_id,
                    "sender_id": user.id,
                    "body": payload.body,
                }
            )
            .execute()
            .data[0]
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=403, detail="Não foi possível enviar a mensagem"
        ) from exc

    admin = get_supabase_admin_client()
    name = _names_for(admin, [user.id]).get(user.id, "Você")

    return MessageOut(
        id=row["id"],
        sender_id=row["sender_id"],
        sender_name=name,
        body=row["body"],
        created_at=row["created_at"],
        is_mine=True,
    )
