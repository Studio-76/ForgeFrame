export type RuntimeModelRecord = {
  id: string;
  provider: string;
  owned_by: string;
  display_name: string;
  active: boolean;
  category: string;
  source: "static" | "discovered";
  discovery_status: string;
  ready: boolean;
  readiness_reason: string | null;
  oauth_required: boolean;
  discovery_supported: boolean;
  capabilities: {
    streaming: boolean;
    tool_calling: boolean;
    vision: boolean;
    external: boolean;
    oauth_required: boolean;
    discovery_support: boolean;
  };
};

export type RuntimeModelsResponse = {
  object: "list";
  data: RuntimeModelRecord[];
};

export async function fetchRuntimeModels(baseUrl = ""): Promise<RuntimeModelsResponse> {
  const response = await fetch(`${baseUrl}/v1/models`);
  if (!response.ok) {
    throw new Error(`Failed to load runtime models (${response.status}).`);
  }

  const payload = (await response.json()) as RuntimeModelsResponse;
  if (!Array.isArray(payload.data)) {
    throw new Error("Runtime models response payload is malformed.");
  }

  return payload;
}
