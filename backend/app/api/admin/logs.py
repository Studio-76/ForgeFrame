"""Admin logs scaffold endpoints (no log aggregation logic)."""

from fastapi import APIRouter

router = APIRouter(prefix="/logs", tags=["admin-logs"])


@router.get("/")
def logs_placeholder() -> dict[str, object]:
    return {
        "status": "scaffold",
        "message": "admin logs endpoint not implemented yet",
        "entries": [],
    }
