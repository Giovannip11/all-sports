from functools import lru_cache

from app.core.supabase import get_supabase_admin_client


@lru_cache
def _sports_table() -> list[dict]:
    """`sports` is small, static reference data (set up by the foundation
    migration) — safe to cache for the life of the process."""
    return get_supabase_admin_client().table("sports").select("id,slug").execute().data


def sport_id_for_slug(slug: str) -> int | None:
    for row in _sports_table():
        if row["slug"] == slug:
            return row["id"]
    return None


def sport_slug_for_id(sport_id: int) -> str:
    for row in _sports_table():
        if row["id"] == sport_id:
            return row["slug"]
    return str(sport_id)
