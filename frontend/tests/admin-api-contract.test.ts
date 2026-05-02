// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearAdminToken,
  fetchAdminSession,
  fetchInstances,
  fetchProviderControlPlane,
  fetchTasks,
  setAdminToken,
} from "../src/api/domain";
import {
  adminSessionFixture,
  instancesFixture,
  providerControlPlaneFixture,
  tasksFixture,
} from "./fixtures/admin-api-contract-fixtures";

/**
 * Ensures a value is an object record.
 * @param value - Candidate value.
 * @returns Object record when valid.
 * @throws {Error} When the value is not an object record.
 */
function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object record.");
  }
  return value as Record<string, unknown>;
}

/**
 * Ensures a record contains a string field.
 * @param record - Source record.
 * @param key - Field name.
 * @throws {Error} When the field is missing or non-string.
 */
function expectStringField(record: Record<string, unknown>, key: string): void {
  if (typeof record[key] !== "string") {
    throw new Error(`Expected '${key}' to be a string.`);
  }
}

/**
 * Validates a representative /admin/auth/me payload contract.
 * @param payload - Parsed backend payload.
 */
function expectAdminSessionContract(payload: unknown): void {
  const response = asRecord(payload);
  expectStringField(response, "status");
  const user = asRecord(response.user);
  [
    "session_id",
    "user_id",
    "username",
    "display_name",
    "role",
    "session_type",
  ].forEach((key) => expectStringField(user, key));
}

/**
 * Validates a representative /admin/instances/ payload contract.
 * @param payload - Parsed backend payload.
 */
function expectInstancesContract(payload: unknown): void {
  const response = asRecord(payload);
  expectStringField(response, "status");
  const instances = response.instances;
  if (!Array.isArray(instances) || instances.length === 0) {
    throw new Error("Expected non-empty instances array.");
  }
  const first = asRecord(instances[0]);
  ["instance_id", "slug", "display_name", "status", "tenant_id", "company_id"]
    .forEach((key) => expectStringField(first, key));
}

/**
 * Validates a representative /admin/providers/ payload contract.
 * @param payload - Parsed backend payload.
 */
function expectProvidersContract(payload: unknown): void {
  const response = asRecord(payload);
  expectStringField(response, "status");
  expectStringField(response, "object");
  const instance = asRecord(response.instance);
  expectStringField(instance, "instance_id");
  if (!Array.isArray(response.providers)) {
    throw new Error("Expected providers to be an array.");
  }
}

/**
 * Validates a representative /admin/tasks payload contract.
 * @param payload - Parsed backend payload.
 */
function expectTasksContract(payload: unknown): void {
  const response = asRecord(payload);
  expectStringField(response, "status");
  const tasks = response.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("Expected non-empty tasks array.");
  }
  const first = asRecord(tasks[0]);
  ["task_id", "instance_id", "company_id", "task_kind", "title", "status", "priority"]
    .forEach((key) => expectStringField(first, key));
}

describe("admin API contract harness", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAdminToken("token-contract");
  });

  afterEach(() => {
    clearAdminToken();
    vi.unstubAllGlobals();
  });

  it("validates /admin/auth/me contract shape with real client path and auth header", async () => {
    expectAdminSessionContract(adminSessionFixture);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(adminSessionFixture), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const payload = await fetchAdminSession();
    expectAdminSessionContract(payload);

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/admin/auth/me");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-contract");
  });

  it("validates /admin/instances/ contract shape", async () => {
    expectInstancesContract(instancesFixture);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(instancesFixture), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const payload = await fetchInstances();
    expectInstancesContract(payload);
    expect(fetchMock).toHaveBeenCalledWith("/admin/instances/", expect.any(Object));
  });

  it("validates /admin/providers/ contract shape with tenant query scoping", async () => {
    expectProvidersContract(providerControlPlaneFixture);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(providerControlPlaneFixture), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const payload = await fetchProviderControlPlane("instance_alpha");
    expectProvidersContract(payload);

    const [path] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(path, "https://forgeframe.local");
    expect(url.pathname).toBe("/admin/providers/");
    expect(url.searchParams.get("instanceId")).toBe("instance_alpha");
  });

  it("validates /admin/tasks contract shape with filter propagation", async () => {
    expectTasksContract(tasksFixture);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(tasksFixture), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const payload = await fetchTasks("instance_alpha", {
      status: "open",
      limit: 50,
    });
    expectTasksContract(payload);

    const [path] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(path, "https://forgeframe.local");
    expect(url.pathname).toBe("/admin/tasks");
    expect(url.searchParams.get("instanceId")).toBe("instance_alpha");
    expect(url.searchParams.get("status")).toBe("open");
    expect(url.searchParams.get("limit")).toBe("50");
  });
});
