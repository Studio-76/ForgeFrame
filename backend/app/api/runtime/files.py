"""Runtime files entrypoints on `/v1/files`."""

from __future__ import annotations

import base64

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse

from app.authz import RequestActor
from app.api.runtime.dependencies import (
    get_runtime_files_service,
    get_runtime_gateway_identity,
    get_settings,
    require_runtime_permission,
)
from app.governance.models import RuntimeGatewayIdentity
from app.runtime_files.service import RuntimeFileNotFoundError, RuntimeFileResolutionError, RuntimeFilesService
from app.settings.config import Settings

from .responses import _runtime_account_id, _runtime_company_id, _runtime_instance_id

router = APIRouter(tags=["runtime-files"])


def _file_not_found(file_id: str) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": {"type": "file_not_found", "message": f"File '{file_id}' was not found."}},
    )


@router.post("/files", response_model=None)
async def create_file(
    request: Request,
    service: RuntimeFilesService = Depends(get_runtime_files_service),
    settings: Settings = Depends(get_settings),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.responses.write")),
) -> object:
    company_id = _runtime_company_id(gateway_identity=gateway_identity, settings=settings)
    instance_id = _runtime_instance_id(gateway_identity=gateway_identity, settings=settings)
    account_id = _runtime_account_id(gateway_identity)
    content_type = request.headers.get("content-type", "")
    purpose = "assistants"
    filename = request.headers.get("x-forgeframe-filename", "").strip() or "upload.bin"
    payload_content_type = request.headers.get("x-forgeframe-content-type", "").strip() or "application/octet-stream"
    content_bytes = b""

    if content_type.lower().startswith("multipart/form-data"):
        try:
            form = await request.form()
        except Exception:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "error": {
                        "type": "invalid_request",
                        "message": "multipart file uploads require a multipart parser on the current host; use JSON base64 upload if unavailable.",
                    }
                },
            )
        purpose = str(form.get("purpose") or purpose)
        uploaded_file = form.get("file")
        if uploaded_file is None:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": {"type": "invalid_request", "message": "multipart file uploads require a 'file' field."}},
            )
        filename = str(getattr(uploaded_file, "filename", "") or filename)
        payload_content_type = str(getattr(uploaded_file, "content_type", "") or payload_content_type)
        content_bytes = await uploaded_file.read()
    elif content_type.lower().startswith("application/json"):
        body = await request.json()
        if not isinstance(body, dict):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": {"type": "invalid_request", "message": "JSON file uploads must provide an object payload."}},
            )
        purpose = str(body.get("purpose") or purpose)
        filename = str(body.get("filename") or filename)
        payload_content_type = str(body.get("content_type") or payload_content_type)
        encoded = str(body.get("content_base64") or "").strip()
        if not encoded:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": {"type": "invalid_request", "message": "JSON file uploads require content_base64."}},
            )
        try:
            content_bytes = base64.b64decode(encoded, validate=True)
        except ValueError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": {"type": "invalid_request", "message": "content_base64 is not valid base64."}},
            )
    else:
        content_bytes = await request.body()

    try:
        payload = service.create_file(
            company_id=company_id,
            instance_id=instance_id,
            account_id=account_id,
            purpose=purpose,
            filename=filename,
            content_type=payload_content_type,
            content_bytes=content_bytes,
        )
    except RuntimeFileResolutionError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"type": exc.error_type, "message": exc.message}},
        )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=payload)


@router.get("/files", response_model=None)
def list_files(
    service: RuntimeFilesService = Depends(get_runtime_files_service),
    settings: Settings = Depends(get_settings),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.responses.read")),
) -> object:
    company_id = _runtime_company_id(gateway_identity=gateway_identity, settings=settings)
    return JSONResponse(content=service.list_files(company_id=company_id))


@router.get("/files/{file_id}", response_model=None)
def get_file(
    file_id: str,
    service: RuntimeFilesService = Depends(get_runtime_files_service),
    settings: Settings = Depends(get_settings),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.responses.read")),
) -> object:
    company_id = _runtime_company_id(gateway_identity=gateway_identity, settings=settings)
    try:
        payload = service.get_file(company_id=company_id, file_id=file_id)
    except RuntimeFileNotFoundError:
        return _file_not_found(file_id)
    return JSONResponse(content=payload)


@router.get("/files/{file_id}/content", response_model=None)
def get_file_content(
    file_id: str,
    service: RuntimeFilesService = Depends(get_runtime_files_service),
    settings: Settings = Depends(get_settings),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.responses.read")),
) -> object:
    company_id = _runtime_company_id(gateway_identity=gateway_identity, settings=settings)
    try:
        content_bytes, content_type, filename = service.get_file_bytes(company_id=company_id, file_id=file_id)
    except RuntimeFileNotFoundError:
        return _file_not_found(file_id)
    return Response(
        content=content_bytes,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/files/{file_id}", response_model=None)
def delete_file(
    file_id: str,
    service: RuntimeFilesService = Depends(get_runtime_files_service),
    settings: Settings = Depends(get_settings),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.responses.write")),
) -> object:
    company_id = _runtime_company_id(gateway_identity=gateway_identity, settings=settings)
    try:
        payload = service.delete_file(company_id=company_id, file_id=file_id)
    except RuntimeFileNotFoundError:
        return _file_not_found(file_id)
    return JSONResponse(content=payload)
