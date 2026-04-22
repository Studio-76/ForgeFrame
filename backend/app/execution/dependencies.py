"""Execution-domain dependency wiring."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException, Query, status
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.execution.admin_service import ExecutionAdminService
from app.execution.service import ExecutionTransitionService
from app.settings.config import Settings, get_settings
from app.storage.models import Base


def _resolve_execution_database_url(settings: Settings) -> str:
    explicit_postgres = settings.execution_postgres_url.strip()
    if explicit_postgres:
        return explicit_postgres
    if settings.harness_storage_backend == "postgresql":
        return settings.harness_postgres_url
    sqlite_path = Path(settings.execution_sqlite_path)
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite+pysqlite:///{sqlite_path}"


@lru_cache(maxsize=1)
def get_execution_session_factory():
    settings = get_settings()
    database_url = _resolve_execution_database_url(settings)
    engine = create_engine(database_url, pool_pre_ping=database_url.startswith("postgresql"))
    Base.metadata.create_all(engine)
    return sessionmaker(engine, autoflush=False, expire_on_commit=False)


@lru_cache(maxsize=1)
def get_execution_transition_service() -> ExecutionTransitionService:
    return ExecutionTransitionService(get_execution_session_factory())


@lru_cache(maxsize=1)
def get_execution_admin_service() -> ExecutionAdminService:
    return ExecutionAdminService(get_execution_session_factory())


def require_execution_company_scope(
    company_id: str | None = Query(default=None, alias="companyId"),
) -> str:
    normalized = (company_id or "").strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="execution_company_scope_required",
        )
    if len(normalized) > 64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="execution_company_scope_invalid",
        )
    return normalized


def clear_execution_dependency_caches() -> None:
    get_execution_session_factory.cache_clear()
    get_execution_transition_service.cache_clear()
    get_execution_admin_service.cache_clear()
