"""Admin API router assembly for protected control-plane modules."""

from fastapi import APIRouter, Depends

from .security import require_admin_session
from .approvals import router as approvals_router
from .accounts import router as accounts_router
from .auth import router as auth_router
from .dashboard import router as dashboard_router
from .execution import router as execution_router
from .keys import router as keys_router
from .logs import router as logs_router
from .providers import router as providers_router
from .security_admin import router as security_admin_router
from .settings import router as settings_router
from .usage import router as usage_router

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(auth_router)
router.include_router(dashboard_router)
router.include_router(approvals_router, dependencies=[Depends(require_admin_session)])
router.include_router(execution_router, dependencies=[Depends(require_admin_session)])
router.include_router(providers_router, dependencies=[Depends(require_admin_session)])
router.include_router(accounts_router, dependencies=[Depends(require_admin_session)])
router.include_router(keys_router, dependencies=[Depends(require_admin_session)])
router.include_router(usage_router, dependencies=[Depends(require_admin_session)])
router.include_router(logs_router)
router.include_router(settings_router, dependencies=[Depends(require_admin_session)])
router.include_router(security_admin_router, dependencies=[Depends(require_admin_session)])
