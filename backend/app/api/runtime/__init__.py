"""Runtime API routers for ForgeFrame target paths.

Lazy-loaded to minimise startup-time import chain.
"""

from __future__ import annotations

from fastapi import APIRouter


def build_runtime_router(api_base: str) -> APIRouter:
    """Build runtime API router tree for a configured API base path.

    Sub-routers are imported lazily so the import chain only runs when
    the function is called (at ``app.main.create_app()`` time).

    :param api_base: Versioned runtime API base prefix.
    :type api_base: str
    :return: Root runtime router with health and versioned routes.
    :rtype: APIRouter
    """
    from .chat import router as chat_router
    from .embeddings import router as embeddings_router
    from .files import router as files_router
    from .health import router as health_router
    from .models import router as models_router
    from .responses import router as responses_router

    versioned_router = APIRouter(prefix=api_base, tags=["runtime-v1"])
    versioned_router.include_router(models_router)
    versioned_router.include_router(chat_router)
    versioned_router.include_router(responses_router)
    versioned_router.include_router(embeddings_router)
    versioned_router.include_router(files_router)

    router = APIRouter(tags=["runtime"])
    router.include_router(health_router)
    router.include_router(versioned_router)
    return router
