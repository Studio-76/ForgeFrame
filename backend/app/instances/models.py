"""Instance-domain models for ForgeFrame's top-level product unit."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID

InstanceStatus = Literal["active", "disabled"]
InstanceDeploymentMode = Literal["linux_host_native", "restricted_eval", "container_optional"]
InstanceExposureMode = Literal["same_origin", "local_only", "edge_admission"]


class InstanceRecord(BaseModel):
    instance_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    slug: str = DEFAULT_BOOTSTRAP_TENANT_ID
    display_name: str = "Default Instance"
    description: str = ""
    status: InstanceStatus = "active"
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    company_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    deployment_mode: InstanceDeploymentMode = "restricted_eval"
    exposure_mode: InstanceExposureMode = "local_only"
    is_default: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str


class InstanceStateRecord(BaseModel):
    schema_version: int = 1
    instances: list[InstanceRecord] = Field(default_factory=list)
    updated_at: str = ""

