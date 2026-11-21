from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Dev-only tunnels (Expo Go/web tunnel and ngrok) get a new random subdomain
    # each run, so an exact allowlist can't cover them.
    allow_origin_regex=r"https://.*\.(exp\.direct|ngrok-free\.(dev|app)|ngrok\.(io|app))"
    if settings.environment == "development"
    else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
