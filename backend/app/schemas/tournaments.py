from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.events import EventStatus, Visibility

TeamStatus = Literal["pending", "confirmed", "waitlisted", "rejected", "canceled"]
MatchStatus = Literal["scheduled", "in_progress", "finished", "walkover", "canceled"]


class TournamentCreate(BaseModel):
    sport: str = Field(min_length=1)
    title: str = Field(min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    location: str = Field(min_length=2)
    latitude: float
    longitude: float
    starts_at: datetime
    max_teams: int = Field(ge=2, le=256)
    players_per_team_min: int = Field(default=1, ge=1, le=50)
    players_per_team_max: int = Field(default=1, ge=1, le=50)
    prize_description: str | None = Field(default=None, max_length=500)
    visibility: Visibility = "public"


class TeamRegister(BaseModel):
    name: str = Field(min_length=2, max_length=60)


class TeamDecision(BaseModel):
    approve: bool


class MatchResult(BaseModel):
    home_score: int = Field(ge=0, le=999)
    away_score: int = Field(ge=0, le=999)
    # Obrigatório só em empate no mata-mata (pênaltis, desempate).
    winner_team_id: str | None = None


class TournamentTeamOut(BaseModel):
    id: str
    name: str
    status: TeamStatus
    captain_id: str | None
    captain_name: str
    is_mine: bool


class MatchTeamOut(BaseModel):
    id: str
    name: str


class MatchOut(BaseModel):
    id: str
    round: int
    position: int
    status: MatchStatus
    home: MatchTeamOut | None
    away: MatchTeamOut | None
    home_score: int | None
    away_score: int | None
    winner_team_id: str | None


class RoundOut(BaseModel):
    round: int
    name: str
    matches: list[MatchOut]


class TournamentOut(BaseModel):
    id: str
    sport: str
    title: str
    description: str | None
    location: str
    latitude: float
    longitude: float
    starts_at: datetime
    status: EventStatus
    visibility: Visibility
    organizer_id: str | None
    organizer_name: str
    is_organizer: bool
    max_teams: int
    confirmed_teams: int
    players_per_team_min: int
    players_per_team_max: int
    prize_description: str | None
    requires_approval: bool
    teams: list[TournamentTeamOut]
    my_team_id: str | None
    rounds: list[RoundOut]
    champion: MatchTeamOut | None
