"""Dependency wiring for conversation and inbox admin services."""

from __future__ import annotations

from functools import lru_cache

from app.conversations.service import ConversationInboxAdminService
from app.execution.dependencies import get_execution_session_factory


@lru_cache(maxsize=1)
def get_conversation_inbox_admin_service() -> ConversationInboxAdminService:
    return ConversationInboxAdminService(get_execution_session_factory())


def clear_conversation_inbox_admin_service_cache() -> None:
    get_conversation_inbox_admin_service.cache_clear()
