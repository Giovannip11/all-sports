from fastapi import APIRouter

from app.api.routes import auth, chat, events, health, map, notifications, teams

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(events.router)
api_router.include_router(map.router)
api_router.include_router(notifications.router)
api_router.include_router(teams.router)
api_router.include_router(chat.router)
