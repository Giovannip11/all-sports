from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase_client() -> Client:
    """Anon-key client — respects RLS, used for normal auth operations (signup/login)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache
def get_supabase_admin_client() -> Client:
    """Service-role client — bypasses RLS. Use only for trusted server-side operations."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_user_scoped_client(access_token: str) -> Client:
    """Anon-key client acting as the given user (so `auth.uid()` resolves inside
    RPCs/RLS). Not cached — a cached client would leak one request's token into
    another's under concurrent requests."""
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client
