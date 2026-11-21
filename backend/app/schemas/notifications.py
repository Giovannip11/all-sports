from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    event_id: str | None
    type: str
    message: str
    read: bool
    created_at: datetime
