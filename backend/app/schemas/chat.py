from datetime import datetime

from pydantic import BaseModel, Field


class MessageOut(BaseModel):
    id: str
    sender_id: str | None
    sender_name: str
    body: str
    created_at: datetime
    is_mine: bool


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
