"""Dependency wiring for skill admin services."""

from __future__ import annotations

from functools import lru_cache

from app.execution.dependencies import get_execution_session_factory
from app.skills.service import SkillAdminService


@lru_cache(maxsize=1)
def get_skill_admin_service() -> SkillAdminService:
    return SkillAdminService(get_execution_session_factory())


def clear_skill_admin_service_cache() -> None:
    get_skill_admin_service.cache_clear()
