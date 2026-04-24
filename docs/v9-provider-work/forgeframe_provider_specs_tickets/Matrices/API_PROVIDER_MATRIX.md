# API Provider Matrix

| Provider ID | Name | Class | Source docs | Auth | Primary contract |
|---|---|---|---|---|---|
| openai | OpenAI | native_openai | API-OpenAI.md | OPENAI_API_KEY | /v1/chat/completions,/v1/responses,/v1/models,/v1/files |
| azure_openai | Azure OpenAI / Foundry | openai_compatible_special | API-AzureOpenAI.md | AZURE_OPENAI_API_KEY or Entra token | /openai/v1/chat/completions,/openai/v1/responses |
| anthropic | Anthropic Claude API | anthropic_messages | API-Anthropic.md | ANTHROPIC_API_KEY or Bearer OAuth token | /v1/messages |
| gemini_openai | Google Gemini OpenAI-compatible | openai_compatible | API-GeminiOpenAICompatible.md | GEMINI_API_KEY or GOOGLE_API_KEY | /v1beta/openai/chat/completions,/models,/embeddings,/images/generations,/videos |
| gemini_native | Google Gemini native generateContent | gemini_native | API-Gemini.md | GEMINI_API_KEY or Google OAuth Bearer | models/*:generateContent, models/*:streamGenerateContent |
| google_vertex_ai | Google Vertex AI OpenAI-compatible | openai_compatible_special | API-GoogleVertexAI.md | Google OAuth / cloud-platform token | /v1/projects/*/locations/*/endpoints/openapi/chat/completions |
| bedrock | AWS Bedrock Converse | bedrock_converse | API-Bedrock.md | AWS SDK/IAM | Bedrock Runtime Converse |
| groq | Groq | openai_compatible | API-Groq.md | GROQ_API_KEY | /openai/v1/chat/completions,/responses,/models,/files,/batches |
| deepseek | DeepSeek | openai_compatible | API-DeepSeek.md | DEEPSEEK_API_KEY | /v1/chat/completions |
| mistral | Mistral AI | openai_compatible_or_native | API-Mistral.md | MISTRAL_API_KEY | /v1/chat/completions,/models |
| together | Together AI | openai_compatible | API-TogetherAI.md | TOGETHER_API_KEY | /v1/chat/completions |
| fireworks | Fireworks AI | openai_compatible | API-FireworksAI.md | FIREWORKS_API_KEY | /inference/v1/chat/completions |
| cerebras | Cerebras | openai_compatible | API-Cerebras.md | CEREBRAS_API_KEY | /v1/chat/completions |
| openrouter | OpenRouter | openai_compatible_aggregator | API-OpenRouter.md | OPENROUTER_API_KEY | /api/v1/chat/completions,/models |
| vercel_ai_gateway | Vercel AI Gateway | openai_compatible_aggregator | API-VercelAIGateway.md | AI_GATEWAY_API_KEY | /v1/chat/completions |
| nous | Nous Portal | openai_compatible_aggregator_oauth | API-NousPortal.md + OAUTH-NousPortal.md | Nous OAuth/agent key | /v1/chat/completions |
| kilocode | Kilo Code | openai_compatible_aggregator | API-KiloCode.md | KILOCODE_API_KEY | /api/gateway/chat/completions |
| huggingface | Hugging Face Router | openai_compatible_router | API-HuggingFace.md | HF_TOKEN | /v1/chat/completions |
| nvidia_nim | NVIDIA NIM | openai_compatible | API-NvidiaNIM.md | NVIDIA_API_KEY | /v1/chat/completions |
| arcee | Arcee AI | openai_compatible | API-ArceeAI.md | ARCEEAI_API_KEY | /api/v1/chat/completions |
| alibaba_dashscope | Alibaba DashScope | openai_or_anthropic_compatible | API-AlibabaDashScope.md | DASHSCOPE_API_KEY | /compatible-mode/v1/chat/completions |
| kimi_moonshot | Kimi / Moonshot | openai_compatible | API-KimiMoonshot.md | KIMI_API_KEY | /v1/chat/completions or /coding/v1/chat/completions |
| minimax | MiniMax | anthropic_compatible | API-MiniMax.md | MINIMAX_API_KEY | /anthropic/v1/messages style |
| perplexity | Perplexity Sonar | openai_compatible_special | API-Perplexity.md | PERPLEXITY_API_KEY | /chat/completions,/v1/sonar,/async/chat/completions |
| ollama | Ollama local | openai_compatible_local | API-Ollama.md | none/local optional | http://localhost:11434/v1/chat/completions,/responses,/embeddings,/models |
| ollama_cloud | Ollama Cloud | openai_compatible | API-OllamaCloud.md | OLLAMA_API_KEY | https://ollama.com/v1/chat/completions |
| localai | LocalAI | openai_compatible_local | API-LocalAI.md | local configured | http://localhost:8080/v1 |
| llama_cpp | llama.cpp server | openai_compatible_local | API-LlamaCpp.md | local configured | /v1/chat/completions,/v1/responses,/v1/embeddings,/v1/messages |
| llama_cpp_python | llama-cpp-python server | openai_compatible_local | API-LlamaCppPython.md | local configured | /v1/chat/completions |
| vllm | vLLM | openai_compatible_local_or_remote | API-vLLM.md | configured token optional | /v1/chat/completions,/v1/completions,/v1/embeddings |
| xai | xAI | openai_compatible | API-xAI.md | XAI_API_KEY | /v1/chat/completions |
| zai | Z.AI / GLM | openai_compatible | API-ZAI.md | ZAI_API_KEY | /v1/chat/completions |
| xiaomi_mimo | Xiaomi MiMo | openai_compatible | API-XiaomiMiMo.md | XIAOMI_MIMO_API_KEY | /v1/chat/completions |
| opencode_zen | OpenCode Zen | gateway_api | API-OpenCodeZen.md | OPENCODE_ZEN_API_KEY | /zen/v1/chat/completions |
| opencode_go | OpenCode Go | mixed_gateway_api | API-OpenCodeGo.md | OPENCODE_GO_API_KEY | /zen/go/v1/chat/completions or /messages |
| openwebui | OpenWebUI openai-compatible endpoint | client_or_provider_compat | API-OpenWebUI.md | configured API keys | /v1/models,/v1/chat/completions,/embeddings |
| continue_openai | Continue OpenAI-compatible provider config | client_config_reference | API-ContinueOpenAI.md | configured key | /chat/completions,/responses,/completions |
| microsoft_agent_framework | Microsoft Agent Framework OpenAI endpoints | agent_endpoint_compat | API-MicrosoftAgentFramework.md | configured auth | /v1/conversations,/v1/responses,/v1/chat/completions |
