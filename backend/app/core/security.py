from fastapi import Header, HTTPException
from supabase_auth.errors import AuthApiError

from app.core.supabase import get_supabase_client


def bearer_token(authorization: str = Header(...)) -> str:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Token ausente ou inválido")
    return token


def authenticated_user(token: str):
    client = get_supabase_client()
    try:
        result = client.auth.get_user(token)
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada") from exc

    if result is None or result.user is None:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada")

    return result.user
