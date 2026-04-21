"""Runtime health endpoint on target path `/health`."""

from fastapi import APIRouter, Depends

from app.api.runtime.dependencies import Settings, get_settings

router = APIRouter(tags=["runtime-health"])


@router.get("/health")
def health(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "api_base": settings.api_base,
    }
