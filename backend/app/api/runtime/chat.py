"""Runtime chat API scaffold endpoints (no product logic)."""

from fastapi import APIRouter

router = APIRouter(prefix="/chat", tags=["runtime-chat"])


@router.post("/")
def chat_placeholder() -> dict[str, str]:
    return {
        "status": "scaffold",
        "message": "runtime chat endpoint not implemented yet",
    }
