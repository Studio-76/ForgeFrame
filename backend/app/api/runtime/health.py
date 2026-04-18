"""Runtime health API scaffold endpoints (no deep health checks)."""

from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["runtime-health"])


@router.get("/")
def health_placeholder() -> dict[str, str]:
    return {
        "status": "scaffold",
        "message": "runtime health checks not implemented yet",
    }
