"""Governance domain exports for auth, accounts, keys, settings and audit."""

from app.governance.models import (
    AdminLoginResult,
    AdminSessionRecord,
    AdminUserRecord,
    AuditEventRecord,
    AuthenticatedAdmin,
    GatewayAccountRecord,
    GovernanceStateRecord,
    IssuedApiKey,
    MutableSettingRecord,
    SecretRotationEventRecord,
    RuntimeGatewayIdentity,
    RuntimeKeyRecord,
)

__all__ = [
    "AdminLoginResult",
    "AdminSessionRecord",
    "AdminUserRecord",
    "AuditEventRecord",
    "AuthenticatedAdmin",
    "GatewayAccountRecord",
    "GovernanceService",
    "GovernanceStateRecord",
    "IssuedApiKey",
    "MutableSettingRecord",
    "SecretRotationEventRecord",
    "RuntimeGatewayIdentity",
    "RuntimeKeyRecord",
    "GovernanceService",
    "get_governance_service",
]


def __getattr__(name: str):
    if name in {"GovernanceService", "get_governance_service"}:
        from app.governance.service import GovernanceService, get_governance_service

        exports = {
            "GovernanceService": GovernanceService,
            "get_governance_service": get_governance_service,
        }
        return exports[name]
    raise AttributeError(name)
