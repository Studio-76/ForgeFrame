"""Admin endpoints for recovery, backup, and restore product truth."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.api.admin.security import require_admin_session, require_admin_write_session
from app.governance.models import AuthenticatedAdmin
from app.recovery.dependencies import RecoveryAdminService, get_recovery_admin_service
from app.recovery.models import (
    CreateRecoveryBackupPolicy,
    ImportRecoveryBackupReport,
    ImportRecoveryRestoreReport,
    ImportRecoveryUpgradeReport,
    UpdateRecoveryBackupPolicy,
)

router = APIRouter(prefix="/recovery", tags=["admin-recovery"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


@router.get("/")
def get_recovery_overview(
    admin: AuthenticatedAdmin = Depends(require_admin_session),
    service: RecoveryAdminService = Depends(get_recovery_admin_service),
) -> dict[str, object]:
    _ = admin
    overview = service.list_overview()
    return {"status": "ok", **overview.model_dump(mode="json")}


@router.post("/backup-policies", status_code=status.HTTP_201_CREATED)
def create_backup_policy(
    payload: CreateRecoveryBackupPolicy,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: RecoveryAdminService = Depends(get_recovery_admin_service),
) -> object:
    _ = admin
    try:
        summary = service.create_policy(payload)
    except ValueError as exc:
        return _error(status.HTTP_409_CONFLICT, "recovery_policy_conflict", str(exc))
    return {"status": "ok", "policy": summary.model_dump(mode="json")}


@router.patch("/backup-policies/{policy_id}")
def update_backup_policy(
    policy_id: str,
    payload: UpdateRecoveryBackupPolicy,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: RecoveryAdminService = Depends(get_recovery_admin_service),
) -> object:
    _ = admin
    try:
        summary = service.update_policy(policy_id, payload)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "recovery_policy_not_found", str(exc))
    return {"status": "ok", "policy": summary.model_dump(mode="json")}


@router.post("/backup-reports/import", status_code=status.HTTP_201_CREATED)
def import_backup_report(
    payload: ImportRecoveryBackupReport,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: RecoveryAdminService = Depends(get_recovery_admin_service),
) -> object:
    _ = admin
    try:
        report, summary = service.import_backup_report(payload)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "recovery_policy_not_found", str(exc))
    return {
        "status": "ok",
        "report": report.model_dump(mode="json"),
        "policy": summary.model_dump(mode="json"),
    }


@router.post("/restore-reports/import", status_code=status.HTTP_201_CREATED)
def import_restore_report(
    payload: ImportRecoveryRestoreReport,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: RecoveryAdminService = Depends(get_recovery_admin_service),
) -> object:
    _ = admin
    try:
        report, summary = service.import_restore_report(payload)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "recovery_policy_not_found", str(exc))
    return {
        "status": "ok",
        "report": report.model_dump(mode="json"),
        "policy": summary.model_dump(mode="json"),
    }


@router.post("/upgrade-reports/import", status_code=status.HTTP_201_CREATED)
def import_upgrade_report(
    payload: ImportRecoveryUpgradeReport,
    admin: AuthenticatedAdmin = Depends(require_admin_write_session),
    service: RecoveryAdminService = Depends(get_recovery_admin_service),
) -> object:
    _ = admin
    try:
        report, posture = service.import_upgrade_report(payload)
    except ValueError as exc:
        return _error(status.HTTP_400_BAD_REQUEST, "recovery_upgrade_report_invalid", str(exc))
    return {
        "status": "ok",
        "report": report.model_dump(mode="json"),
        "upgrade_posture": posture.model_dump(mode="json"),
    }
