"""Runtime models API scaffold endpoints (no provider/model logic)."""

from fastapi import APIRouter

router = APIRouter(prefix="/models", tags=["runtime-models"])


@router.get("/")
def list_models_placeholder() -> dict[str, object]:
    return {
        "status": "scaffold",
        "message": "runtime models endpoint not implemented yet",
        "models": [],
    }
