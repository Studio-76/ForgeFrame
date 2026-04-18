"""ForgeGate backend application bootstrap (phase-5 runtime)."""

from fastapi import FastAPI

from app.api.admin import router as admin_router
from app.api.runtime import router as runtime_router
from app.settings.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        description="ForgeGate runtime/admin gateway with phase-5 runtime.",
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
    return app


app = create_app()
