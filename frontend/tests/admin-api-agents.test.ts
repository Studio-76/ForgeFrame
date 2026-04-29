// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearAdminToken, fetchAgents, setAdminToken } from "../src/api/admin";

describe("agent admin API helpers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      status: "ok",
      instance: null,
      agents: [],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    setAdminToken("token-alpha");
  });

  afterEach(() => {
    clearAdminToken();
    vi.unstubAllGlobals();
  });

  it("forwards an explicit Operator repair request to the backend query string", async () => {
    await fetchAgents("instance_alpha", {
      status: "all",
      limit: 100,
      ensureDefaultOperator: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(path, "https://forgeframe.local");
    expect(url.pathname).toBe("/admin/agents");
    expect(url.searchParams.get("instanceId")).toBe("instance_alpha");
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.get("ensureDefaultOperator")).toBe("true");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-alpha");
  });
});
