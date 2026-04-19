"""Provider-axis taxonomy used across runtime and control plane."""

from typing import Literal

ProviderAxis = Literal["oauth_account", "openai_compatible_provider", "local_provider", "openai_compatible_client"]

AuthMechanism = Literal["oauth_account", "api_key", "hybrid_oauth_api_key", "none", "gateway_key"]
