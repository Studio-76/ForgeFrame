"""Snapshot and operator view helpers for the control plane."""

from __future__ import annotations


class ControlPlaneSnapshotDomainMixin:
    def provider_control_snapshot(self, tenant_id: str | None = None) -> list[dict[str, object]]:
        return [truth.ui.model_dump() for truth in self.provider_truth_axes(tenant_id=tenant_id)]
