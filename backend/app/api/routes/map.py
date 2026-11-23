from fastapi import APIRouter, Depends

from app.api.routes.events import _joined_event_ids, _visible_events_for
from app.core.security import authenticated_user, bearer_token
from app.core.sports import sport_slug_for_id
from app.core.supabase import get_supabase_admin_client
from app.schemas.map import MapMarkerOut

router = APIRouter(prefix="/map", tags=["map"])


@router.get("/markers", response_model=list[MapMarkerOut])
def list_map_markers(
    sport: str | None = None, token: str = Depends(bearer_token)
) -> list[MapMarkerOut]:
    """Coordinates + metadata for every event the user can see on the map:
    public open events, plus ones they organize or joined."""
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    rows = _visible_events_for(admin, user.id, sport)
    joined_ids = _joined_event_ids(admin, user.id)

    return [
        MapMarkerOut(
            id=row["id"],
            sport=sport_slug_for_id(row["sport_id"]),
            title=row["title"],
            location=row["location_name"],
            latitude=row["latitude"],
            longitude=row["longitude"],
            starts_at=row["starts_at"],
            visibility=row["visibility"],
            status=row["status"],
            participants_count=row["confirmed_count"],
            max_participants=row["max_participants"],
            is_organizer=row["organizer_id"] == user.id,
            is_participant=row["id"] in joined_ids,
        )
        for row in rows
    ]
