from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TeamMode = Literal["random", "balanced"]


class TeamDrawRequest(BaseModel):
    team_count: int = Field(ge=2, le=50)
    mode: TeamMode = "random"


class TeamMemberOut(BaseModel):
    user_id: str
    name: str
    events_played: int


class TeamOut(BaseModel):
    id: str
    name: str
    position: int
    members: list[TeamMemberOut]


class TeamDrawOut(BaseModel):
    id: str
    mode: TeamMode
    team_count: int
    created_at: datetime
    teams: list[TeamOut]
