"""ORM substrate for persisted runtime responses objects."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.storage.harness_repository import Base

RUNTIME_RESPONSE_PROCESSING_MODES = ("sync", "background")
RUNTIME_RESPONSE_LIFECYCLE_STATUSES = ("queued", "in_progress", "completed", "failed", "incomplete")


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _enum_check(name: str, column: str, values: tuple[str, ...]) -> CheckConstraint:
    joined = ", ".join(f"'{value}'" for value in values)
    return CheckConstraint(f"{column} IN ({joined})", name=name)


class RuntimeResponseORM(Base):
    __tablename__ = "runtime_responses"
    __table_args__ = (
        _enum_check(
            "runtime_responses_processing_mode_ck",
            "processing_mode",
            RUNTIME_RESPONSE_PROCESSING_MODES,
        ),
        _enum_check(
            "runtime_responses_lifecycle_status_ck",
            "lifecycle_status",
            RUNTIME_RESPONSE_LIFECYCLE_STATUSES,
        ),
        Index("runtime_responses_company_id_id_uq", "company_id", "id", unique=True),
        Index(
            "runtime_responses_company_status_created_idx",
            "company_id",
            "lifecycle_status",
            "created_at",
        ),
        Index(
            "runtime_responses_company_run_created_idx",
            "company_id",
            "execution_run_id",
            "created_at",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    instance_id: Mapped[str] = mapped_column(String(64), nullable=False)
    account_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    request_path: Mapped[str] = mapped_column(Text, nullable=False)
    processing_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    lifecycle_status: Mapped[str] = mapped_column(String(32), nullable=False)
    background: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stream: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requested_model: Mapped[str | None] = mapped_column(String(191), nullable=True)
    resolved_model: Mapped[str | None] = mapped_column(String(191), nullable=True)
    provider_key: Mapped[str | None] = mapped_column(String(191), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_items: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=list,
    )
    request_tools: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=list,
    )
    request_tool_choice: Mapped[dict[str, Any] | str | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    request_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=dict,
    )
    request_controls: Mapped[dict[str, Any]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=dict,
    )
    request_client: Mapped[dict[str, str]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=dict,
    )
    native_mapping: Mapped[dict[str, Any]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=dict,
    )
    response_body: Mapped[dict[str, Any]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
    )
    error_json: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    execution_run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
