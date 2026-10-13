from fastapi import APIRouter, Depends, Header, HTTPException, status
from supabase_auth.errors import AuthApiError

from app.core.supabase import get_supabase_client
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    Role,
    SessionOut,
    SignupRequest,
    SignupResponse,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user, role_fallback: Role = "practice") -> UserOut:
    metadata = user.user_metadata or {}
    return UserOut(
        id=user.id,
        email=user.email,
        name=metadata.get("name", ""),
        role=metadata.get("role", role_fallback),
    )


def _session_out(session) -> SessionOut:
    return SessionOut(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in,
    )


def _bearer_token(authorization: str = Header(...)) -> str:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Token ausente ou inválido")
    return token


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest) -> SignupResponse:
    client = get_supabase_client()
    try:
        result = client.auth.sign_up(
            {
                "email": payload.email,
                "password": payload.password,
                "options": {"data": {"name": payload.name, "role": payload.role}},
            }
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

    if result.user is None:
        raise HTTPException(status_code=400, detail="Não foi possível criar a conta")

    if result.session is not None:
        return SignupResponse(
            user=_user_out(result.user, payload.role),
            session=_session_out(result.session),
            message="Conta criada com sucesso.",
        )

    return SignupResponse(
        user=_user_out(result.user, payload.role),
        session=None,
        message="Conta criada. Verifique seu e-mail para confirmar o cadastro antes de entrar.",
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    client = get_supabase_client()
    try:
        result = client.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except AuthApiError as exc:
        if exc.code == "email_not_confirmed":
            raise HTTPException(
                status_code=403, detail="Confirme seu e-mail antes de entrar"
            ) from exc
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos") from exc

    if result.session is None or result.user is None:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

    return LoginResponse(user=_user_out(result.user), session=_session_out(result.session))


@router.get("/me", response_model=UserOut)
def me(token: str = Depends(_bearer_token)) -> UserOut:
    client = get_supabase_client()
    try:
        result = client.auth.get_user(token)
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada") from exc

    if result is None or result.user is None:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada")

    return _user_out(result.user)
