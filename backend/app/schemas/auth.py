from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Role = Literal["practice", "organize"]


class SignupRequest(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=6)
    role: Role = "practice"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: Role


class SessionOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class SignupResponse(BaseModel):
    user: UserOut
    session: SessionOut | None
    message: str


class LoginResponse(BaseModel):
    user: UserOut
    session: SessionOut
