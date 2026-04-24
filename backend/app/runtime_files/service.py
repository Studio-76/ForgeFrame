"""Runtime file upload/list/read helpers for OpenAI-compatible surfaces."""

from __future__ import annotations

import base64
import hashlib
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session, sessionmaker

from app.responses.models import NormalizedResponsesRequest
from app.storage.runtime_files_repository import RuntimeFileORM


class RuntimeFileNotFoundError(RuntimeError):
    """Raised when a runtime file does not exist inside the current company scope."""


class RuntimeFileResolutionError(ValueError):
    """Raised when a runtime file cannot be consumed on a given runtime path."""

    def __init__(self, *, error_type: str, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.error_type = error_type
        self.message = message
        self.status_code = status_code


class RuntimeFilesService:
    _MAX_FILE_BYTES = 25 * 1024 * 1024
    _MAX_INLINE_IMAGE_BYTES = 8 * 1024 * 1024

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    @staticmethod
    def _now(now: datetime | None = None) -> datetime:
        if now is None:
            return datetime.now(tz=UTC)
        if now.tzinfo is None:
            raise ValueError("timestamps must be timezone-aware")
        return now.astimezone(UTC)

    @staticmethod
    def _new_file_id() -> str:
        return f"file_{uuid4().hex}"

    @staticmethod
    def _record_payload(row: RuntimeFileORM) -> dict[str, object]:
        return {
            "id": row.id,
            "object": "file",
            "bytes": int(row.bytes_count),
            "created_at": int(row.created_at.timestamp()),
            "filename": row.filename,
            "purpose": row.purpose,
            "status": "processed",
        }

    def create_file(
        self,
        *,
        company_id: str,
        instance_id: str,
        account_id: str | None,
        purpose: str,
        filename: str,
        content_type: str,
        content_bytes: bytes,
        now: datetime | None = None,
    ) -> dict[str, object]:
        if not filename.strip():
            raise RuntimeFileResolutionError(
                error_type="invalid_request",
                message="Uploaded runtime files require a non-empty filename.",
                status_code=400,
            )
        if not content_bytes:
            raise RuntimeFileResolutionError(
                error_type="invalid_request",
                message="Uploaded runtime files must not be empty.",
                status_code=400,
            )
        if len(content_bytes) > self._MAX_FILE_BYTES:
            raise RuntimeFileResolutionError(
                error_type="file_too_large",
                message="Uploaded runtime file exceeds the current size limit.",
                status_code=413,
            )
        current_time = self._now(now)
        row = RuntimeFileORM(
            id=self._new_file_id(),
            company_id=company_id,
            instance_id=instance_id,
            account_id=account_id,
            purpose=(purpose or "assistants").strip() or "assistants",
            filename=filename.strip(),
            content_type=(content_type or "application/octet-stream").strip() or "application/octet-stream",
            bytes_count=len(content_bytes),
            sha256=hashlib.sha256(content_bytes).hexdigest(),
            content_bytes=content_bytes,
            created_at=current_time,
            updated_at=current_time,
        )
        with self._session_factory() as session, session.begin():
            session.add(row)
        return self._record_payload(row)

    def list_files(self, *, company_id: str) -> dict[str, object]:
        with self._session_factory() as session:
            rows = (
                session.query(RuntimeFileORM)
                .filter(RuntimeFileORM.company_id == company_id)
                .order_by(RuntimeFileORM.created_at.desc())
                .all()
            )
        return {"object": "list", "data": [self._record_payload(row) for row in rows]}

    def get_file(self, *, company_id: str, file_id: str) -> dict[str, object]:
        with self._session_factory() as session:
            row = session.get(RuntimeFileORM, file_id)
            if row is None or row.company_id != company_id:
                raise RuntimeFileNotFoundError(file_id)
            return self._record_payload(row)

    def get_file_bytes(self, *, company_id: str, file_id: str) -> tuple[bytes, str, str]:
        with self._session_factory() as session:
            row = session.get(RuntimeFileORM, file_id)
            if row is None or row.company_id != company_id:
                raise RuntimeFileNotFoundError(file_id)
            return bytes(row.content_bytes), row.content_type, row.filename

    def delete_file(self, *, company_id: str, file_id: str) -> dict[str, object]:
        with self._session_factory() as session, session.begin():
            row = session.get(RuntimeFileORM, file_id)
            if row is None or row.company_id != company_id:
                raise RuntimeFileNotFoundError(file_id)
            session.delete(row)
        return {"id": file_id, "object": "file", "deleted": True}

    def materialize_response_input_files(
        self,
        *,
        company_id: str,
        request: NormalizedResponsesRequest,
    ) -> NormalizedResponsesRequest:
        updated_items: list[dict[str, object]] = []
        changed = False
        for item in request.input_items:
            if str(item.get("type", "") or "") != "message":
                updated_items.append(dict(item))
                continue
            updated_item = dict(item)
            content_blocks: list[dict[str, object]] = []
            for block in list(item.get("content") or []):
                normalized_block = dict(block)
                if str(normalized_block.get("type", "") or "") == "input_image" and not str(normalized_block.get("image_url", "") or "").strip():
                    file_id = str(normalized_block.get("file_id", "") or "").strip()
                    if not file_id:
                        content_blocks.append(normalized_block)
                        continue
                    content_bytes, content_type, _filename = self.get_file_bytes(company_id=company_id, file_id=file_id)
                    if not content_type.lower().startswith("image/"):
                        raise RuntimeFileResolutionError(
                            error_type="unsupported_input",
                            message=f"Runtime file '{file_id}' is not an image and cannot be used as input_image.",
                            status_code=422,
                        )
                    if len(content_bytes) > self._MAX_INLINE_IMAGE_BYTES:
                        raise RuntimeFileResolutionError(
                            error_type="file_too_large",
                            message=f"Runtime file '{file_id}' is too large for inline image materialization on the current responses path.",
                            status_code=413,
                        )
                    encoded = base64.b64encode(content_bytes).decode("ascii")
                    normalized_block["image_url"] = f"data:{content_type};base64,{encoded}"
                    changed = True
                content_blocks.append(normalized_block)
            updated_item["content"] = content_blocks
            updated_items.append(updated_item)
        if not changed:
            return request
        return request.model_copy(update={"input_items": updated_items})
