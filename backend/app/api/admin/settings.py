"""Admin settings scaffold endpoints (no persisted configuration logic)."""

from fastapi import APIRouter

router = APIRouter(prefix="/settings", tags=["admin-settings"])


@router.get("/")
def settings_placeholder() -> dict[str, object]:
    return {
        "status": "scaffold",
        "message": "admin settings endpoint not implemented yet",
        "settings": {},
    }
