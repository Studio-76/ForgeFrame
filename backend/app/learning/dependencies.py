"""Dependency wiring for learning admin services."""

from __future__ import annotations

from functools import lru_cache

from app.execution.dependencies import get_execution_session_factory
from app.learning.service import LearningAdminService


@lru_cache(maxsize=1)
def get_learning_admin_service() -> LearningAdminService:
    return LearningAdminService(get_execution_session_factory())


def clear_learning_admin_service_cache() -> None:
    get_learning_admin_service.cache_clear()
