from datetime import date, timedelta
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.cpf import is_valid_cpf, normalize_cpf

Role = Literal["practice", "organize"]
Gender = Literal["masculino", "feminino", "outro", "prefiro_nao_informar"]
Plan = Literal["gratuito", "casual", "intermediario", "arena"]
# Mesmo enum `public.skill_level` do banco (tabela user_sports).
SkillLevel = Literal["beginner", "intermediate", "advanced"]
MAX_USER_SPORTS = 7

MIN_SIGNUP_AGE = 16


class SignupRequest(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str = Field(min_length=8)
    birth_date: date
    cpf: str
    gender: Gender
    country: str = Field(default="Brasil", min_length=2)
    role: Role = "practice"
    accepted_terms: bool
    location_consent: bool = False
    # Slugs dos esportes que a pessoa pratica, em ordem de prioridade (RF05).
    sports: list[str] = Field(default_factory=list, max_length=MAX_USER_SPORTS)

    @field_validator("accepted_terms")
    @classmethod
    def must_accept_terms(cls, value: bool) -> bool:
        if not value:
            raise ValueError("É necessário aceitar os termos de uso para criar a conta")
        return value

    @field_validator("birth_date")
    @classmethod
    def must_be_old_enough(cls, value: date) -> date:
        cutoff = date.today().replace(year=date.today().year - MIN_SIGNUP_AGE)
        if value > cutoff:
            raise ValueError(f"Você precisa ter pelo menos {MIN_SIGNUP_AGE} anos para se cadastrar")
        if value < date.today() - timedelta(days=365 * 120):
            raise ValueError("Data de nascimento inválida")
        return value

    @field_validator("cpf")
    @classmethod
    def must_be_valid_cpf(cls, value: str) -> str:
        if not is_valid_cpf(value):
            raise ValueError("CPF inválido")
        return normalize_cpf(value)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: Role
    phone: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    location_consent: bool = False
    birth_date: date | None = None
    cpf: str | None = None
    gender: Gender | None = None
    country: str | None = None
    plan: Plan = "gratuito"


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2)
    phone: str | None = Field(default=None, min_length=8)
    bio: str | None = Field(default=None, max_length=280)
    # Tipo de conta (Jogador/Organizador). Fica no user_metadata, como no
    # cadastro; create_event já lê dali, então a troca vale na hora.
    role: Role | None = None


class UserSportIn(BaseModel):
    sport: str = Field(min_length=1)
    skill_level: SkillLevel = "beginner"


class UserSportsUpdate(BaseModel):
    """Lista completa e ordenada: a posição na lista é a prioridade (1 = principal)."""

    sports: list[UserSportIn] = Field(max_length=MAX_USER_SPORTS)


class UserSportOut(BaseModel):
    sport: str
    skill_level: SkillLevel
    position: int


class PlanUpdateRequest(BaseModel):
    plan: Plan


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
