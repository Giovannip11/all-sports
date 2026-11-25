from datetime import datetime

from pydantic import BaseModel

from app.schemas.events import EventKind, EventStatus, Visibility


class MapMarkerOut(BaseModel):
    id: str
    kind: EventKind = "pickup"
    sport: str
    title: str
    location: str
    latitude: float
    longitude: float
    starts_at: datetime
    visibility: Visibility
    status: EventStatus
    participants_count: int
    max_participants: int
    is_organizer: bool
    is_participant: bool
