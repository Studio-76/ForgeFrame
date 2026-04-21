"""Gateway account service exports."""

from app.governance.service import GovernanceService, get_governance_service

__all__ = ["GovernanceService", "get_governance_service"]
