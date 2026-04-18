"""Admin accounts scaffold endpoints (no account management logic)."""

from fastapi import APIRouter

router = APIRouter(prefix="/accounts", tags=["admin-accounts"])


@router.get("/")
def accounts_placeholder() -> dict[str, object]:
    return {
        "status": "scaffold",
        "message": "admin accounts management not implemented yet",
        "accounts": [],
    }
