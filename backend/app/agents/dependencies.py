"""Dependency wiring for agent admin services."""

from __future__ import annotations

from functools import lru_cache

from app.agents.service import AgentAdminService
from app.execution.dependencies import get_execution_session_factory


@lru_cache(maxsize=1)
def get_agent_admin_service() -> AgentAdminService:
    return AgentAdminService(get_execution_session_factory())


def clear_agent_admin_service_cache() -> None:
    get_agent_admin_service.cache_clear()
