"""Admin provider scaffold endpoints (no provider integration logic)."""

from fastapi import APIRouter

router = APIRouter(prefix="/providers", tags=["admin-providers"])


@router.get("/")
def providers_placeholder() -> dict[str, object]:
    return {
        "status": "scaffold",
        "message": "admin providers management not implemented yet",
        "providers": [],
    }
