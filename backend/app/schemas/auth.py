from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

Role = Literal["practice", "organize"]


class SignupRequest(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str = Field(min_length=8)
    role: Role = "practice"
    accepted_terms: bool
    location_consent: bool = False

    @field_validator("accepted_terms")
    @classmethod
    def must_accept_terms(cls, value: bool) -> bool:
        if not value:
            raise ValueError("É necessário aceitar os termos de uso para criar a conta")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: Role
    phone: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    location_consent: bool = False


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2)
    phone: str | None = Field(default=None, min_length=8)
    bio: str | None = Field(default=None, max_length=280)


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
