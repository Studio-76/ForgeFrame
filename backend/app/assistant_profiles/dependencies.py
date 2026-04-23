"""Dependency wiring for assistant-profile admin services."""

from __future__ import annotations

from functools import lru_cache

from app.assistant_profiles.service import AssistantProfileAdminService
from app.execution.dependencies import get_execution_session_factory


@lru_cache(maxsize=1)
def get_assistant_profile_admin_service() -> AssistantProfileAdminService:
    return AssistantProfileAdminService(get_execution_session_factory())


def clear_assistant_profile_admin_service_cache() -> None:
    get_assistant_profile_admin_service.cache_clear()

