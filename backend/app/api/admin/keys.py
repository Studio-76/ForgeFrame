"""Admin API key scaffold endpoints (no key lifecycle logic)."""

from fastapi import APIRouter

router = APIRouter(prefix="/keys", tags=["admin-keys"])


@router.get("/")
def keys_placeholder() -> dict[str, object]:
    return {
        "status": "scaffold",
        "message": "admin api keys management not implemented yet",
        "keys": [],
    }
