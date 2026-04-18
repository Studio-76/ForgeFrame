"""Usage and cost helper service for phase-5 runtime accounting foundations."""

from __future__ import annotations

import math

from app.settings.config import Settings
from app.usage.models import CostBreakdown, TokenUsage


class UsageAccountingService:
    def __init__(self, settings: Settings):
        self._settings = settings

    @staticmethod
    def estimate_tokens_from_text(text: str) -> int:
        if not text.strip():
            return 0
        # simple deterministic heuristic: ~4 chars/token with floor safety
        return max(1, math.ceil(len(text) / 4))

    def estimate_from_messages(self, messages: list[dict]) -> int:
        total_chars = 0
        for message in messages:
            content = message.get("content", "")
            total_chars += len(content if isinstance(content, str) else str(content))
        return self.estimate_tokens_from_text("x" * total_chars)

    def usage_from_prompt_completion(self, messages: list[dict], completion_text: str) -> TokenUsage:
        input_tokens = self.estimate_from_messages(messages)
        output_tokens = self.estimate_tokens_from_text(completion_text)
        return TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
        )

    def costs_for_provider(self, *, provider: str, usage: TokenUsage, oauth_mode: bool = False) -> CostBreakdown:
        if provider == "openai_api":
            actual = self._cost_from_rates(
                usage,
                self._settings.pricing_openai_input_per_1m_tokens,
                self._settings.pricing_openai_output_per_1m_tokens,
            )
            return CostBreakdown(
                actual_cost=actual,
                hypothetical_cost=actual,
                avoided_cost=0.0,
                pricing_basis="api_metered",
            )

        if provider == "openai_codex":
            hypothetical = self._cost_from_rates(
                usage,
                self._settings.pricing_codex_hypothetical_input_per_1m_tokens,
                self._settings.pricing_codex_hypothetical_output_per_1m_tokens,
            )
            return CostBreakdown(
                actual_cost=0.0 if oauth_mode else hypothetical,
                hypothetical_cost=hypothetical,
                avoided_cost=hypothetical if oauth_mode else 0.0,
                pricing_basis="oauth_subscription" if oauth_mode else "api_metered",
            )

        hypothetical = self._cost_from_rates(
            usage,
            self._settings.pricing_internal_hypothetical_input_per_1m_tokens,
            self._settings.pricing_internal_hypothetical_output_per_1m_tokens,
        )
        return CostBreakdown(
            actual_cost=0.0,
            hypothetical_cost=hypothetical,
            avoided_cost=hypothetical,
            pricing_basis="internal",
        )

    @staticmethod
    def _cost_from_rates(usage: TokenUsage, input_rate_per_1m: float, output_rate_per_1m: float) -> float:
        input_cost = (usage.input_tokens / 1_000_000) * input_rate_per_1m
        output_cost = (usage.output_tokens / 1_000_000) * output_rate_per_1m
        return round(input_cost + output_cost, 8)
