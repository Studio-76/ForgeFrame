"""Dependency wiring for contacts, knowledge sources, and memory services."""

from __future__ import annotations

from functools import lru_cache

from app.execution.dependencies import get_execution_session_factory
from app.knowledge.service import KnowledgeContextAdminService


@lru_cache(maxsize=1)
def get_knowledge_context_admin_service() -> KnowledgeContextAdminService:
    return KnowledgeContextAdminService(get_execution_session_factory())


def clear_knowledge_context_admin_service_cache() -> None:
    get_knowledge_context_admin_service.cache_clear()

