"""Snapshot and operator view helpers for the control plane."""

from __future__ import annotations


class ControlPlaneSnapshotDomainMixin:
    def provider_control_snapshot(self) -> list[dict[str, object]]:
        return [truth.ui.model_dump() for truth in self.provider_truth_axes()]
