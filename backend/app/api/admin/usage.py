"""Admin usage scaffold endpoints (no analytics/business metrics logic)."""

from fastapi import APIRouter

router = APIRouter(prefix="/usage", tags=["admin-usage"])


@router.get("/")
def usage_placeholder() -> dict[str, object]:
    return {
        "status": "scaffold",
        "message": "admin usage endpoint not implemented yet",
        "items": [],
    }
