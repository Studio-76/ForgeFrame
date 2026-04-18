"""Model registry domain models for ForgeGate runtime."""

from typing import Literal

from pydantic import BaseModel


class RuntimeModel(BaseModel):
    id: str
    provider: str
    owned_by: str
    display_name: str
    category: str = "general"
    active: bool = True
    source: Literal["static", "discovered"] = "static"
    discovery_status: str = "catalog"


class ModelsListResponse(BaseModel):
    object: str = "list"
    data: list[RuntimeModel]
