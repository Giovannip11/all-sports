import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from supabase_auth.errors import AuthApiError

from app.core.rate_limit import rate_limit_login, rate_limit_password_reset, rate_limit_signup
from app.core.security import authenticated_user, bearer_token
from app.core.sports import sport_id_for_slug, sport_slug_for_id
from app.core.supabase import get_supabase_admin_client, get_supabase_client
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    PlanUpdateRequest,
    ProfileUpdateRequest,
    Role,
    SessionOut,
    SignupRequest,
    SignupResponse,
    UserOut,
    UserSportIn,
    UserSportOut,
    UserSportsUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])

AVATAR_BUCKET = "avatars"
ALLOWED_AVATAR_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024


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
        location_consent=bool(metadata.get("location_consent", False)),
        birth_date=metadata.get("birth_date"),
        cpf=metadata.get("cpf"),
        gender=metadata.get("gender"),
        country=metadata.get("country"),
        plan=metadata.get("plan", "gratuito"),
    )


def _load_user_sports(admin, user_id: str) -> list[UserSportOut]:
    rows = (
        admin.table("user_sports")
        .select("sport_id,skill_level,position")
        .eq("user_id", user_id)
        .order("position")
        .execute()
        .data
    )
    return [
        UserSportOut(
            sport=sport_slug_for_id(row["sport_id"]),
            skill_level=row["skill_level"],
            position=row["position"],
        )
        for row in rows
    ]


def _save_user_sports(admin, user_id: str, items: list[UserSportIn]) -> list[UserSportOut]:
    """Substitui os esportes do usuário (tabela user_sports) pela lista dada,
    na ordem recebida. Slugs desconhecidos e repetidos são recusados."""
    rows: list[dict] = []
    seen: set[int] = set()
    for item in items:
        sport_id = sport_id_for_slug(item.sport)
        if sport_id is None:
            raise HTTPException(status_code=400, detail=f"Esporte inválido: {item.sport}")
        if sport_id in seen:
            continue
        seen.add(sport_id)
        rows.append(
            {
                "user_id": user_id,
                "sport_id": sport_id,
                "skill_level": item.skill_level,
                "position": len(rows) + 1,
            }
        )

    admin.table("user_sports").delete().eq("user_id", user_id).execute()
    if rows:
        admin.table("user_sports").insert(rows).execute()
    return _load_user_sports(admin, user_id)


def _session_out(session) -> SessionOut:
    return SessionOut(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in,
    )


@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_signup)],
)
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
                        "birth_date": payload.birth_date.isoformat(),
                        "cpf": payload.cpf,
                        "gender": payload.gender,
                        "country": payload.country,
                        "location_consent": payload.location_consent,
                        "terms_accepted_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            }
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

    if result.user is None:
        raise HTTPException(status_code=400, detail="Não foi possível criar a conta")

    # Esportes escolhidos no cadastro (antes eram validados no app e descartados).
    # O perfil é criado por trigger no insert em auth.users, então já existe aqui.
    # Falha aqui não impede a conta: a pessoa pode escolher de novo no perfil.
    if payload.sports:
        try:
            _save_user_sports(
                get_supabase_admin_client(),
                result.user.id,
                [UserSportIn(sport=slug) for slug in payload.sports],
            )
        except Exception:  # noqa: BLE001
            pass

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


@router.post("/login", response_model=LoginResponse, dependencies=[Depends(rate_limit_login)])
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


@router.post(
    "/forgot-password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(rate_limit_password_reset)],
)
def forgot_password(payload: ForgotPasswordRequest) -> None:
    """Sends a password-reset e-mail. Always responds 204 regardless of
    whether the address has an account, so this can't be used to find out
    which e-mails are registered."""
    client = get_supabase_client()
    try:
        client.auth.reset_password_for_email(payload.email)
    except AuthApiError:
        pass


@router.get("/me", response_model=UserOut)
def me(token: str = Depends(bearer_token)) -> UserOut:
    user = authenticated_user(token)
    return _user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(payload: ProfileUpdateRequest, token: str = Depends(bearer_token)) -> UserOut:
    user = authenticated_user(token)
    metadata = dict(user.user_metadata or {})

    patch = payload.model_dump(exclude_none=True)
    metadata.update(patch)

    admin = get_supabase_admin_client()
    updated = admin.auth.admin.update_user_by_id(user.id, {"user_metadata": metadata})
    return _user_out(updated.user, role_fallback=metadata.get("role", "practice"))


@router.get("/me/sports", response_model=list[UserSportOut])
def get_my_sports(token: str = Depends(bearer_token)) -> list[UserSportOut]:
    """Esportes de interesse do usuário, em ordem de prioridade, com o nível em cada um."""
    user = authenticated_user(token)
    return _load_user_sports(get_supabase_admin_client(), user.id)


@router.put("/me/sports", response_model=list[UserSportOut])
def put_my_sports(
    payload: UserSportsUpdate, token: str = Depends(bearer_token)
) -> list[UserSportOut]:
    user = authenticated_user(token)
    return _save_user_sports(get_supabase_admin_client(), user.id, payload.sports)


@router.patch("/me/plan", response_model=UserOut)
def update_plan(payload: PlanUpdateRequest, token: str = Depends(bearer_token)) -> UserOut:
    user = authenticated_user(token)
    metadata = dict(user.user_metadata or {})
    metadata["plan"] = payload.plan

    admin = get_supabase_admin_client()
    updated = admin.auth.admin.update_user_by_id(user.id, {"user_metadata": metadata})
    return _user_out(updated.user, role_fallback=metadata.get("role", "practice"))


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    token: str = Depends(bearer_token), file: UploadFile | None = None
) -> UserOut:
    if file is None:
        raise HTTPException(status_code=400, detail="Envie um arquivo de imagem")

    extension = ALLOWED_AVATAR_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(status_code=400, detail="Formato de imagem não suportado")

    user = authenticated_user(token)
    contents = await file.read()
    if len(contents) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="Imagem muito grande (máximo 5MB)")

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


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(token: str = Depends(bearer_token)) -> None:
    """Exclui a conta e os dados do usuário (LGPD-02).

    Remove o usuário do Supabase Auth; isso também apaga, em cascata, seus
    eventos organizados, inscrições e notificações (ver migração
    0001_events_notifications.sql), pois as tabelas referenciam auth.users
    com ON DELETE CASCADE.
    """
    user = authenticated_user(token)
    admin = get_supabase_admin_client()

    avatar_url = (user.user_metadata or {}).get("avatar_url")
    if avatar_url:
        path = "/".join(avatar_url.split(f"/{AVATAR_BUCKET}/")[-1:])
        if path:
            admin.storage.from_(AVATAR_BUCKET).remove([path])

    admin.auth.admin.delete_user(user.id)
