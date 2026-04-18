"""Admin auth scaffold endpoints (no real authentication flow)."""

from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["admin-auth"])


@router.get("/")
def auth_placeholder() -> dict[str, str]:
    return {"status": "scaffold", "message": "admin auth not implemented yet"}
