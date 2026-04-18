"""Runtime API router assembly for the phase-2 scaffold."""

from fastapi import APIRouter

from .chat import router as chat_router
from .health import router as health_router
from .models import router as models_router

router = APIRouter(prefix="/runtime", tags=["runtime"])
router.include_router(chat_router)
router.include_router(models_router)
router.include_router(health_router)
