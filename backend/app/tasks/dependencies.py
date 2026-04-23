"""Dependency wiring for tasking and delivery admin services."""

from __future__ import annotations

from functools import lru_cache

from app.execution.dependencies import get_execution_session_factory
from app.tasks.service import TaskAutomationAdminService


@lru_cache(maxsize=1)
def get_task_automation_admin_service() -> TaskAutomationAdminService:
    return TaskAutomationAdminService(get_execution_session_factory())


def clear_task_automation_admin_service_cache() -> None:
    get_task_automation_admin_service.cache_clear()
