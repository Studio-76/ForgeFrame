"""ForgeGate backend application bootstrap."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import ASGIApp, Receive, Scope, Send

from app.api.admin import router as admin_router
from app.api.runtime import router as runtime_router
from app.authz.route_guards import RouteGuardHTTPException
from app.idempotency import (
    InvalidIdempotencyKeyError,
    build_request_envelope,
    validate_idempotency_key,
)
from app.readiness import (
    RuntimeReadinessReport,
    StartupValidationError,
    build_health_payload,
    build_public_runtime_readiness_payload,
    ensure_runtime_startup_validated,
    reset_runtime_readiness_state,
)
from app.settings.config import get_settings


class StartupValidationGateMiddleware:
    """ASGI startup gate that avoids the decorator middleware streaming regression."""

    def __init__(self, app: ASGIApp, *, default_api_base: str):
        self.app = app
        self.default_api_base = default_api_base

    @staticmethod
    def _is_startup_bypass_path(path: str | None) -> bool:
        return bool(path and path.startswith("/admin/auth"))

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        app = scope.get("app")
        if app is None:
            await self.app(scope, receive, send)
            return

        if self._is_startup_bypass_path(scope.get("path")):
            await self.app(scope, receive, send)
            return

        if getattr(app.state, "runtime_startup_checks", None) is None:
            try:
                ensure_runtime_startup_validated(app)
            except StartupValidationError as exc:
                app.state.runtime_startup_checks = exc.checks
                app.state.runtime_readiness = RuntimeReadinessReport.from_checks(exc.checks)
                await self._startup_failure_response(app, scope, receive, send, app.state.runtime_readiness)
                return

        readiness = getattr(app.state, "runtime_readiness", None)
        if isinstance(readiness, RuntimeReadinessReport) and not readiness.accepting_traffic:
            await self._startup_failure_response(app, scope, receive, send, readiness)
            return

        await self.app(scope, receive, send)

    async def _startup_failure_response(
        self,
        app: FastAPI,
        scope: Scope,
        receive: Receive,
        send: Send,
        readiness: RuntimeReadinessReport,
    ) -> None:
        api_base = str(getattr(app.state, "runtime_api_base", self.default_api_base))
        if scope.get("path") == "/health":
            response = JSONResponse(
                status_code=503,
                content=build_health_payload(
                    app_name=app.title,
                    app_version=app.version,
                    api_base=api_base,
                    readiness=readiness,
                ),
            )
        else:
            response = JSONResponse(
                status_code=503,
                content={
                    "error": {
                        "type": "startup_validation_failed",
                        "message": "ForgeGate startup validation failed.",
                        "details": build_public_runtime_readiness_payload(readiness),
                    }
                },
            )
        await response(scope, receive, send)


def _mount_frontend(app: FastAPI, dist_path: Path) -> None:
    if not dist_path.exists():
        return

    assets_path = dist_path / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="frontend-assets")

    @app.get("/app/{full_path:path}")
    def frontend_app(full_path: str) -> FileResponse:  # pragma: no cover - simple static route
        index = dist_path / "index.html"
        return FileResponse(index)


@asynccontextmanager
async def _lifespan(app: FastAPI):
    reset_runtime_readiness_state(app)
    ensure_runtime_startup_validated(app)
    yield
    reset_runtime_readiness_state(app)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        description="ForgeGate runtime/admin gateway with harness control-plane.",
        lifespan=_lifespan,
    )
    app.state.runtime_api_base = settings.api_base
    reset_runtime_readiness_state(app)

    @app.get("/")
    def root_info() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "status": "ok",
            "message": "ForgeGate runtime, admin and control-plane modules are available.",
        }

    @app.exception_handler(RouteGuardHTTPException)
    def handle_route_guard_exception(_request: Request, exc: RouteGuardHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "type": detail.get("code") or "forbidden",
                    "message": detail.get("message") or "Forbidden.",
                    "details": detail.get("details") or {},
                    "request_id": detail.get("requestId"),
                }
            },
        )

    @app.exception_handler(HTTPException)
    def handle_http_exception(_request: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict) and ("code" in detail or "message" in detail):
            return JSONResponse(
                status_code=exc.status_code,
                headers=exc.headers,
                content={
                    "error": {
                        "type": detail.get("code") or "http_error",
                        "message": detail.get("message") or "Request failed.",
                        "details": detail.get("details") or {},
                    }
                },
            )
        return JSONResponse(
            status_code=exc.status_code,
            headers=exc.headers,
            content={"detail": detail},
        )

    def _apply_request_envelope_headers(response: JSONResponse | FileResponse, request: Request) -> None:
        envelope = getattr(request.state, "request_envelope", None)
        if envelope is None:
            return
        response.headers["X-ForgeGate-Request-Id"] = envelope.request_id
        response.headers["X-ForgeGate-Correlation-Id"] = envelope.correlation_id
        response.headers["X-ForgeGate-Causation-Id"] = envelope.causation_id
        response.headers["X-ForgeGate-Trace-Id"] = envelope.trace_id
        if envelope.span_id:
            response.headers["X-ForgeGate-Span-Id"] = envelope.span_id
        if envelope.idempotency_key:
            response.headers["Idempotency-Key"] = envelope.idempotency_key

    @app.middleware("http")
    async def request_envelope_middleware(request: Request, call_next):
        envelope = build_request_envelope(request)
        request.state.request_envelope = envelope
        if envelope.idempotency_key is not None:
            try:
                validate_idempotency_key(envelope.idempotency_key)
            except InvalidIdempotencyKeyError as exc:
                response = JSONResponse(
                    status_code=400,
                    content={"error": {"type": "invalid_idempotency_key", "message": str(exc)}},
                )
                _apply_request_envelope_headers(response, request)
                return response

        response = await call_next(request)
        _apply_request_envelope_headers(response, request)
        return response

    app.add_middleware(StartupValidationGateMiddleware, default_api_base=settings.api_base)
    app.include_router(runtime_router)
    app.include_router(admin_router)
    _mount_frontend(app, Path(settings.frontend_dist_path))
    return app


app = create_app()
