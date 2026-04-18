"""Usage and cost domain models for runtime accounting foundations."""

from pydantic import BaseModel


class TokenUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


class CostBreakdown(BaseModel):
    currency: str = "USD"
    actual_cost: float = 0.0
    hypothetical_cost: float = 0.0
    avoided_cost: float = 0.0
    pricing_basis: str = "internal"


class UsageEnvelope(BaseModel):
    provider: str
    model: str
    credential_type: str
    auth_source: str
    usage: TokenUsage
    cost: CostBreakdown
