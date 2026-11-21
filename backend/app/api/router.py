from fastapi import APIRouter

from app.api.routes import auth, events, health, map, notifications

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(events.router)
api_router.include_router(map.router)
api_router.include_router(notifications.router)
