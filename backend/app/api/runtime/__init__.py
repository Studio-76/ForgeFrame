"""Runtime API routers for ForgeGate target paths."""

from fastapi import APIRouter

from .chat import router as chat_router
from .health import router as health_router
from .models import router as models_router

router = APIRouter(tags=["runtime"])
router.include_router(health_router)
router.include_router(models_router)
router.include_router(chat_router)
