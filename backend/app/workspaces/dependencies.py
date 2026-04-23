"""Dependency wiring for work interaction admin services."""

from __future__ import annotations

from functools import lru_cache

from app.execution.dependencies import get_execution_session_factory
from app.workspaces.service import WorkInteractionAdminService


@lru_cache(maxsize=1)
def get_work_interaction_admin_service() -> WorkInteractionAdminService:
    return WorkInteractionAdminService(get_execution_session_factory())


def clear_work_interaction_admin_service_cache() -> None:
    get_work_interaction_admin_service.cache_clear()
