"""ForgeGate backend application bootstrap."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.admin import router as admin_router
from app.api.runtime import router as runtime_router
from app.settings.config import get_settings


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


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        description="ForgeGate runtime/admin gateway with harness control-plane.",
    )

    @app.get("/")
    def root_info() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "status": "phase-5-runtime",
            "message": "Runtime paths enabled with stream-ready dispatch baseline.",
        }

    app.include_router(runtime_router)
    app.include_router(admin_router)
    _mount_frontend(app, Path(settings.frontend_dist_path))
    return app


app = create_app()
