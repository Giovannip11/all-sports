import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, status
from supabase_auth.errors import AuthApiError

from app.core.supabase import get_supabase_admin_client, get_supabase_client
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    ProfileUpdateRequest,
    Role,
    SessionOut,
    SignupRequest,
    SignupResponse,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])

AVATAR_BUCKET = "avatars"
ALLOWED_AVATAR_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _user_out(user, role_fallback: Role = "practice") -> UserOut:
    metadata = user.user_metadata or {}
    return UserOut(
        id=user.id,
        email=user.email,
        name=metadata.get("name", ""),
        role=metadata.get("role", role_fallback),
        phone=metadata.get("phone"),
        bio=metadata.get("bio"),
        avatar_url=metadata.get("avatar_url"),
    )


def _authenticated_user(token: str):
    client = get_supabase_client()
    try:
        result = client.auth.get_user(token)
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada") from exc

    if result is None or result.user is None:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada")

    return result.user


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
                "options": {
                    "data": {
                        "name": payload.name,
                        "role": payload.role,
                        "phone": payload.phone,
                    }
                },
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
    user = _authenticated_user(token)
    return _user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(payload: ProfileUpdateRequest, token: str = Depends(_bearer_token)) -> UserOut:
    user = _authenticated_user(token)
    metadata = dict(user.user_metadata or {})

    patch = payload.model_dump(exclude_none=True)
    metadata.update(patch)

    admin = get_supabase_admin_client()
    updated = admin.auth.admin.update_user_by_id(user.id, {"user_metadata": metadata})
    return _user_out(updated.user, role_fallback=metadata.get("role", "practice"))


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    token: str = Depends(_bearer_token), file: UploadFile | None = None
) -> UserOut:
    if file is None:
        raise HTTPException(status_code=400, detail="Envie um arquivo de imagem")

    extension = ALLOWED_AVATAR_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(status_code=400, detail="Formato de imagem não suportado")

    user = _authenticated_user(token)
    contents = await file.read()

    admin = get_supabase_admin_client()
    path = f"{user.id}/{uuid.uuid4().hex}.{extension}"
    admin.storage.from_(AVATAR_BUCKET).upload(
        path, contents, {"content-type": file.content_type, "upsert": "true"}
    )
    avatar_url = admin.storage.from_(AVATAR_BUCKET).get_public_url(path)

    metadata = dict(user.user_metadata or {})
    metadata["avatar_url"] = avatar_url
    updated = admin.auth.admin.update_user_by_id(user.id, {"user_metadata": metadata})
    return _user_out(updated.user, role_fallback=metadata.get("role", "practice"))
