"""Runtime health endpoint on target path `/health`."""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.api.runtime.dependencies import Settings, get_settings
from app.governance.service import GovernanceService, get_governance_service
from app.harness.service import HarnessService, get_harness_service
from app.readiness import build_health_payload, build_runtime_readiness_report, ensure_runtime_startup_validated
from app.usage.analytics import UsageAnalyticsStore, get_usage_analytics_store

router = APIRouter(tags=["runtime-health"])


@router.get("/health")
def health(
    request: Request,
    settings: Settings = Depends(get_settings),
    governance: GovernanceService = Depends(get_governance_service),
    harness: HarnessService = Depends(get_harness_service),
    analytics: UsageAnalyticsStore = Depends(get_usage_analytics_store),
) -> JSONResponse:
    startup_checks = ensure_runtime_startup_validated(request.app)
    readiness = build_runtime_readiness_report(
        settings=settings,
        startup_checks=startup_checks,
        governance=governance,
        harness=harness,
        analytics=analytics,
        app=request.app,
    )
    request.app.state.runtime_readiness = readiness
    return JSONResponse(
        status_code=200 if readiness.accepting_traffic else 503,
        content=build_health_payload(
            app_name=settings.app_name,
            app_version=settings.app_version,
            api_base=settings.api_base,
            readiness=readiness,
        ),
    )
