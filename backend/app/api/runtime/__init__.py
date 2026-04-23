"""Runtime API routers for ForgeFrame target paths."""

from fastapi import APIRouter

from app.settings.config import get_settings

from .chat import router as chat_router
from .health import router as health_router
from .models import router as models_router
from .responses import router as responses_router

settings = get_settings()
versioned_router = APIRouter(prefix=settings.api_base, tags=["runtime-v1"])
versioned_router.include_router(models_router)
versioned_router.include_router(chat_router)
versioned_router.include_router(responses_router)

router = APIRouter(tags=["runtime"])
router.include_router(health_router)
router.include_router(versioned_router)
