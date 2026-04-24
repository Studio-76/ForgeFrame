"""ORM substrate for persisted runtime files objects."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.storage.harness_repository import Base


def _now() -> datetime:
    return datetime.now(tz=UTC)


class RuntimeFileORM(Base):
    __tablename__ = "runtime_files"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    instance_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    account_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    purpose: Mapped[str] = mapped_column(String(64), nullable=False, default="assistants")
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(191), nullable=False, default="application/octet-stream")
    bytes_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    content_bytes: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
