from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Visibility = Literal["public", "private"]
EventStatus = Literal["draft", "open", "full", "in_progress", "finished", "canceled"]
RegistrationStatus = Literal["confirmed", "waitlisted", "canceled"]


class EventCreate(BaseModel):
    sport: str = Field(min_length=1)
    title: str = Field(min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    location: str = Field(min_length=2)
    latitude: float
    longitude: float
    starts_at: datetime
    max_participants: int = Field(ge=2, le=5000)
    visibility: Visibility = "public"


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, min_length=2)
    latitude: float | None = None
    longitude: float | None = None
    starts_at: datetime | None = None
    max_participants: int | None = Field(default=None, ge=2, le=5000)
    visibility: Visibility | None = None
    status: EventStatus | None = None


class ParticipantOut(BaseModel):
    user_id: str
    name: str
    status: RegistrationStatus
    presence_confirmed: bool
    joined_at: datetime


EventKind = Literal["pickup", "meetup", "tournament"]


class EventOut(BaseModel):
    id: str
    # "tournament" abre a tela de torneio; vagas/inscritos contam equipes.
    kind: EventKind = "pickup"
    organizer_id: str
    organizer_name: str
    sport: str
    title: str
    description: str | None
    location: str
    latitude: float
    longitude: float
    starts_at: datetime
    max_participants: int
    visibility: Visibility
    status: EventStatus
    participants_count: int
    is_participant: bool
    is_organizer: bool
    created_at: datetime


class EventDetailOut(EventOut):
    participants: list[ParticipantOut]
