"""Snapshot and operator view helpers for the control plane."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any


class ControlPlaneSnapshotDomainMixin:
    if TYPE_CHECKING:

        def provider_truth_axes(self, *args: Any, **kwargs: Any) -> list[Any]: ...

    def provider_control_snapshot(
        self,
        tenant_id: str | None = None,
        instance_id: str | None = None,
    ) -> list[dict[str, Any]]:
        return [truth.ui.model_dump() for truth in self.provider_truth_axes(tenant_id=tenant_id, instance_id=instance_id)]
