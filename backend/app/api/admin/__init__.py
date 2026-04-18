"""Admin API router assembly for the phase-2 scaffold."""

from fastapi import APIRouter

from .accounts import router as accounts_router
from .auth import router as auth_router
from .keys import router as keys_router
from .logs import router as logs_router
from .providers import router as providers_router
from .settings import router as settings_router
from .usage import router as usage_router

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(auth_router)
router.include_router(providers_router)
router.include_router(accounts_router)
router.include_router(keys_router)
router.include_router(usage_router)
router.include_router(logs_router)
router.include_router(settings_router)
