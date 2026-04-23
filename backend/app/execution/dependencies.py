"""Execution-domain dependency wiring."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import Depends, HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.admin.instance_scope import require_admin_instance_scope
from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.core.routing import RoutingService
from app.instances.models import InstanceRecord
from app.instances.service import get_instance_service
from app.execution.admin_service import ExecutionAdminService
from app.execution.service import ExecutionTransitionService
from app.execution.worker_service import ExecutionWorkerService
from app.providers import ProviderRegistry
from app.responses.service import ResponsesService
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


@lru_cache(maxsize=1)
def get_execution_provider_registry() -> ProviderRegistry:
    return ProviderRegistry(get_settings())


@lru_cache(maxsize=32)
def _build_execution_dispatch_service(instance_id: str) -> DispatchService:
    settings = get_settings()
    registry = ModelRegistry(settings, instance_id=instance_id)
    routing = RoutingService(registry, get_execution_provider_registry(), settings, instance_id=instance_id)
    return DispatchService(routing, get_execution_provider_registry())


@lru_cache(maxsize=1)
def get_execution_responses_service() -> ResponsesService:
    return ResponsesService(
        get_execution_session_factory(),
        execution=get_execution_transition_service(),
    )


@lru_cache(maxsize=1)
def get_execution_worker_service() -> ExecutionWorkerService:
    return ExecutionWorkerService(
        get_execution_session_factory(),
        settings=get_settings(),
        execution=get_execution_transition_service(),
        responses=get_execution_responses_service(),
        instance_service=get_instance_service(),
        provider_registry=get_execution_provider_registry(),
        dispatch_factory=_build_execution_dispatch_service,
    )


def require_execution_company_scope(
    instance: InstanceRecord = Depends(require_admin_instance_scope),
) -> str:
    normalized = instance.company_id.strip()
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
    get_execution_provider_registry.cache_clear()
    _build_execution_dispatch_service.cache_clear()
    get_execution_responses_service.cache_clear()
    get_execution_worker_service.cache_clear()
