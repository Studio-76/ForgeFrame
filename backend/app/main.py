"""ForgeGate backend application (phase-2 scaffold only).

This service is intentionally minimal and only provides startable placeholder
endpoints. Runtime core, provider orchestration, OAuth flows, streaming,
tool-calling, fallback, and business logic are not implemented in this phase.
"""

from fastapi import FastAPI

from app.api.admin import router as admin_router
from app.api.runtime import router as runtime_router


def create_app() -> FastAPI:
    app = FastAPI(title="ForgeGate — Smart AI Gateway")

    @app.get("/")
    def root_info() -> dict[str, str]:
        return {
            "name": "ForgeGate — Smart AI Gateway",
            "status": "scaffold",
            "phase": "phase-2 minimal runnable foundation",
            "message": "core implementation pending",
        }

    app.include_router(runtime_router)
    app.include_router(admin_router)
    return app


app = create_app()
