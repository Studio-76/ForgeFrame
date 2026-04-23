"""Admin API router assembly for protected control-plane modules."""

from fastapi import APIRouter, Depends

from .security import require_admin_session


def build_admin_router() -> APIRouter:
    # Import routers lazily so execution/governance dependencies can safely import
    # individual admin submodules without triggering a package-level circular import.
    from .accounts import router as accounts_router
    from .assistant_profiles import router as assistant_profiles_router
    from .artifacts import router as artifacts_router
    from .approvals import router as approvals_router
    from .auth import router as auth_router
    from .automations import router as automations_router
    from .conversations import router as conversations_router
    from .channels import router as channels_router
    from .contacts import router as contacts_router
    from .dashboard import router as dashboard_router
    from .execution import router as execution_router
    from .ingress import router as ingress_router
    from .inbox import router as inbox_router
    from .instances import router as instances_router
    from .knowledge_sources import router as knowledge_sources_router
    from .keys import router as keys_router
    from .logs import router as logs_router
    from .memory import router as memory_router
    from .models import router as models_router
    from .notifications import router as notifications_router
    from .plugins import router as plugins_router
    from .provider_targets import router as provider_targets_router
    from .providers import router as providers_router
    from .reminders import router as reminders_router
    from .routing import router as routing_router
    from .security_admin import router as security_admin_router
    from .settings import router as settings_router
    from .tasks import router as tasks_router
    from .usage import router as usage_router
    from .workspaces import router as workspaces_router

    router = APIRouter(prefix="/admin", tags=["admin"])
    router.include_router(auth_router)
    router.include_router(dashboard_router)
    router.include_router(instances_router, dependencies=[Depends(require_admin_session)])
    router.include_router(models_router, dependencies=[Depends(require_admin_session)])
    router.include_router(provider_targets_router, dependencies=[Depends(require_admin_session)])
    router.include_router(routing_router, dependencies=[Depends(require_admin_session)])
    router.include_router(approvals_router, dependencies=[Depends(require_admin_session)])
    router.include_router(tasks_router, dependencies=[Depends(require_admin_session)])
    router.include_router(reminders_router, dependencies=[Depends(require_admin_session)])
    router.include_router(channels_router, dependencies=[Depends(require_admin_session)])
    router.include_router(notifications_router, dependencies=[Depends(require_admin_session)])
    router.include_router(automations_router, dependencies=[Depends(require_admin_session)])
    router.include_router(assistant_profiles_router, dependencies=[Depends(require_admin_session)])
    router.include_router(contacts_router, dependencies=[Depends(require_admin_session)])
    router.include_router(knowledge_sources_router, dependencies=[Depends(require_admin_session)])
    router.include_router(memory_router, dependencies=[Depends(require_admin_session)])
    router.include_router(conversations_router, dependencies=[Depends(require_admin_session)])
    router.include_router(execution_router, dependencies=[Depends(require_admin_session)])
    router.include_router(ingress_router, dependencies=[Depends(require_admin_session)])
    router.include_router(inbox_router, dependencies=[Depends(require_admin_session)])
    router.include_router(providers_router, dependencies=[Depends(require_admin_session)])
    router.include_router(plugins_router, dependencies=[Depends(require_admin_session)])
    router.include_router(accounts_router, dependencies=[Depends(require_admin_session)])
    router.include_router(keys_router, dependencies=[Depends(require_admin_session)])
    router.include_router(workspaces_router, dependencies=[Depends(require_admin_session)])
    router.include_router(artifacts_router, dependencies=[Depends(require_admin_session)])
    router.include_router(usage_router, dependencies=[Depends(require_admin_session)])
    router.include_router(logs_router)
    router.include_router(settings_router, dependencies=[Depends(require_admin_session)])
    router.include_router(security_admin_router, dependencies=[Depends(require_admin_session)])
    return router


__all__ = ["build_admin_router"]
