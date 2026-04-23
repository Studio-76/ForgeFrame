// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchWorkspacesMock,
  fetchWorkspaceDetailMock,
  createWorkspaceMock,
  updateWorkspaceMock,
  fetchArtifactsMock,
  fetchArtifactDetailMock,
  createArtifactMock,
  updateArtifactMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchWorkspacesMock: vi.fn(),
  fetchWorkspaceDetailMock: vi.fn(),
  createWorkspaceMock: vi.fn(),
  updateWorkspaceMock: vi.fn(),
  fetchArtifactsMock: vi.fn(),
  fetchArtifactDetailMock: vi.fn(),
  createArtifactMock: vi.fn(),
  updateArtifactMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchWorkspaces: fetchWorkspacesMock,
    fetchWorkspaceDetail: fetchWorkspaceDetailMock,
    createWorkspace: createWorkspaceMock,
    updateWorkspace: updateWorkspaceMock,
    fetchArtifacts: fetchArtifactsMock,
    fetchArtifactDetail: fetchArtifactDetailMock,
    createArtifact: createArtifactMock,
    updateArtifact: updateArtifactMock,
  };
});

import type { AdminSessionUser, ArtifactRecord, WorkspaceDetail, WorkspaceSummary } from "../src/api/admin";
import { ArtifactsPage } from "../src/pages/ArtifactsPage";
import { WorkspacesPage } from "../src/pages/WorkspacesPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createWorkspaceSummary(overrides: Partial<WorkspaceSummary> = {}): WorkspaceSummary {
  return {
    workspace_id: "ws_alpha",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    issue_id: "FOR-178",
    title: "Alpha workspace",
    summary: "Workspace summary",
    status: "previewing",
    preview_status: "ready",
    review_status: "pending",
    handoff_status: "not_ready",
    owner_type: "user",
    owner_id: "user-admin",
    active_run_id: "run_alpha",
    latest_approval_id: "run:instance_alpha:company_alpha:approval-1",
    preview_artifact_id: "artifact_preview",
    handoff_artifact_id: null,
    pr_reference: null,
    handoff_reference: null,
    metadata: {},
    run_count: 1,
    approval_count: 1,
    artifact_count: 1,
    latest_event_at: "2026-04-23T10:00:00Z",
    created_at: "2026-04-23T09:00:00Z",
    updated_at: "2026-04-23T10:00:00Z",
    ...overrides,
  };
}

function createWorkspaceDetail(overrides: Partial<WorkspaceDetail> = {}): WorkspaceDetail {
  return {
    ...createWorkspaceSummary(),
    runs: [
      {
        run_id: "run_alpha",
        run_kind: "provider_dispatch",
        state: "waiting_approval",
        execution_lane: "background_agentic",
        issue_id: "FOR-178",
        updated_at: "2026-04-23T10:00:00Z",
      },
    ],
    approvals: [
      {
        approval_id: "approval-1",
        shared_approval_id: "run:instance_alpha:company_alpha:approval-1",
        gate_status: "open",
        gate_key: "provider.sync.approval",
        opened_at: "2026-04-23T09:30:00Z",
        decided_at: null,
      },
    ],
    artifacts: [
      {
        artifact_id: "artifact_preview",
        instance_id: "instance_alpha",
        company_id: "company_alpha",
        workspace_id: "ws_alpha",
        artifact_type: "preview_link",
        label: "Preview package",
        uri: "https://forgeframe.local/previews/ws_alpha",
        media_type: "text/html",
        preview_url: "https://forgeframe.local/previews/ws_alpha",
        size_bytes: 2048,
        status: "active",
        created_by_type: "user",
        created_by_id: "user-admin",
        metadata: {},
        attachments: [],
        created_at: "2026-04-23T09:45:00Z",
        updated_at: "2026-04-23T09:45:00Z",
      },
    ],
    events: [
      {
        event_id: "evt_workspace_created",
        workspace_id: "ws_alpha",
        event_kind: "created",
        note: "Workspace created",
        artifact_id: null,
        approval_id: null,
        run_id: "run_alpha",
        actor_type: "user",
        actor_id: "user-admin",
        created_at: "2026-04-23T09:00:00Z",
      },
    ],
    ...overrides,
  };
}

function createArtifactRecord(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    artifact_id: "artifact_preview",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    workspace_id: "ws_alpha",
    artifact_type: "preview_link",
    label: "Preview package",
    uri: "https://forgeframe.local/previews/ws_alpha",
    media_type: "text/html",
    preview_url: "https://forgeframe.local/previews/ws_alpha",
    size_bytes: 2048,
    status: "active",
    created_by_type: "user",
    created_by_id: "user-admin",
    metadata: {},
    attachments: [
      {
        attachment_id: "attach_run_alpha",
        artifact_id: "artifact_preview",
        target_kind: "run",
        target_id: "run_alpha",
        role: "related",
        created_at: "2026-04-23T09:45:00Z",
      },
    ],
    created_at: "2026-04-23T09:45:00Z",
    updated_at: "2026-04-23T09:45:00Z",
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root | null = null;

async function renderIntoDom(element: ReactNode) {
  root = createRoot(container);
  await act(async () => {
    root?.render(element);
  });
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(control) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event(control.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [
      {
        instance_id: "instance_alpha",
        slug: "instance-alpha",
        display_name: "Alpha Instance",
        description: "Alpha",
        status: "active",
        tenant_id: "tenant_alpha",
        company_id: "company_alpha",
        deployment_mode: "linux_host_native",
        exposure_mode: "same_origin",
        is_default: true,
        metadata: {},
        created_at: "2026-04-23T09:00:00Z",
        updated_at: "2026-04-23T09:00:00Z",
      },
    ],
  });
  fetchWorkspacesMock.mockResolvedValue({
    status: "ok",
    instance: null,
    workspaces: [createWorkspaceSummary()],
  });
  fetchWorkspaceDetailMock.mockResolvedValue({
    status: "ok",
    workspace: createWorkspaceDetail(),
  });
  createWorkspaceMock.mockResolvedValue({
    status: "ok",
    workspace: createWorkspaceDetail({ workspace_id: "ws_beta", title: "Beta workspace" }),
  });
  updateWorkspaceMock.mockResolvedValue({
    status: "ok",
    workspace: createWorkspaceDetail({ title: "Alpha workspace updated" }),
  });
  fetchArtifactsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    artifacts: [createArtifactRecord()],
  });
  fetchArtifactDetailMock.mockResolvedValue({
    status: "ok",
    artifact: createArtifactRecord(),
  });
  createArtifactMock.mockResolvedValue({
    status: "ok",
    artifact: createArtifactRecord({ artifact_id: "artifact_handoff", label: "Handoff note", artifact_type: "handoff_note" }),
  });
  updateArtifactMock.mockResolvedValue({
    status: "ok",
    artifact: createArtifactRecord({ label: "Preview package updated" }),
  });
  container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
});

afterEach(() => {
  if (!root) {
    return;
  }
  act(() => {
    root?.unmount();
  });
  root = null;
});

describe("work interaction pages", () => {
  it("renders the workspaces page with live workspace detail", async () => {
    await renderIntoDom(withAppContext({
      path: "/workspaces?instanceId=instance_alpha&workspaceId=ws_alpha",
      element: <WorkspacesPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchWorkspacesMock).toHaveBeenCalledWith("instance_alpha", "all", 100);
    expect(fetchWorkspaceDetailMock).toHaveBeenCalledWith("ws_alpha", "instance_alpha");
    expect(container.textContent).toContain("Workspace Inventory");
    expect(container.textContent).toContain("Alpha workspace");
    expect(container.textContent).toContain("Event history");

    const artifactsLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open Workspace Artifacts");
    expect(artifactsLink?.getAttribute("href")).toBe("/artifacts?instanceId=instance_alpha&workspaceId=ws_alpha");
  });

  it("creates and updates workspaces against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/workspaces?instanceId=instance_alpha&workspaceId=ws_alpha",
      element: <WorkspacesPage />,
      session: adminSession,
    }));
    await flushEffects();

    const forms = Array.from(container.querySelectorAll("form"));
    const createForm = forms.find((form) => form.textContent?.includes("Create workspace"));
    const editForm = forms.find((form) => form.textContent?.includes("Save workspace"));
    const createInputs = Array.from(createForm?.querySelectorAll("input") ?? []);
    const createTextareas = Array.from(createForm?.querySelectorAll("textarea") ?? []);
    const createSelects = Array.from(createForm?.querySelectorAll("select") ?? []);
    const createButton = Array.from(createForm?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("Create workspace"));
    const editInputs = Array.from(editForm?.querySelectorAll("input") ?? []);
    const editTextareas = Array.from(editForm?.querySelectorAll("textarea") ?? []);
    const saveButton = Array.from(editForm?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("Save workspace"));

    await act(async () => {
      setControlValue(createInputs[0] as HTMLInputElement, "ws_beta");
      setControlValue(createInputs[1] as HTMLInputElement, "Beta workspace");
      setControlValue(createTextareas[0] as HTMLTextAreaElement, "New workspace summary");
      setControlValue(createSelects[0] as HTMLSelectElement, "ready");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createWorkspaceMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      workspace_id: "ws_beta",
      title: "Beta workspace",
      summary: "New workspace summary",
      preview_status: "ready",
    }));

    await act(async () => {
      setControlValue(editInputs[0] as HTMLInputElement, "Alpha workspace updated");
      setControlValue(editTextareas[0] as HTMLTextAreaElement, "Updated workspace summary");
      saveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateWorkspaceMock).toHaveBeenCalledWith("instance_alpha", "ws_alpha", expect.objectContaining({
      title: "Alpha workspace updated",
      summary: "Updated workspace summary",
    }));
  });

  it("renders the artifacts page and preserves attachment truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/artifacts?instanceId=instance_alpha&artifactId=artifact_preview",
      element: <ArtifactsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchArtifactsMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      workspaceId: undefined,
      targetKind: undefined,
      targetId: undefined,
      limit: 100,
    });
    expect(fetchArtifactDetailMock).toHaveBeenCalledWith("artifact_preview", "instance_alpha");
    expect(container.textContent).toContain("Artifact inventory");
    expect(container.textContent).toContain("Preview package");

    const runLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open execution review");
    expect(runLink?.getAttribute("href")).toBe("/execution?instanceId=instance_alpha&runId=run_alpha");
  });

  it("creates and updates artifacts against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/artifacts?instanceId=instance_alpha&artifactId=artifact_preview",
      element: <ArtifactsPage />,
      session: adminSession,
    }));
    await flushEffects();

    const forms = Array.from(container.querySelectorAll("form"));
    const createForm = forms.find((form) => form.textContent?.includes("Create artifact"));
    const editForm = forms.find((form) => form.textContent?.includes("Save artifact"));
    const createInputs = Array.from(createForm?.querySelectorAll("input") ?? []);
    const createSelects = Array.from(createForm?.querySelectorAll("select") ?? []);
    const createButton = Array.from(createForm?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("Create artifact"));
    const editInputs = Array.from(editForm?.querySelectorAll("input") ?? []);
    const saveButton = Array.from(editForm?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("Save artifact"));

    await act(async () => {
      setControlValue(createInputs[0] as HTMLInputElement, "ws_alpha");
      setControlValue(createInputs[1] as HTMLInputElement, "Handoff note");
      setControlValue(createInputs[2] as HTMLInputElement, "file:///var/lib/forgeframe/handoff.md");
      setControlValue(createSelects[1] as HTMLSelectElement, "handoff_note");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createArtifactMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      workspace_id: "ws_alpha",
      label: "Handoff note",
      uri: "file:///var/lib/forgeframe/handoff.md",
      artifact_type: "handoff_note",
    }));

    await act(async () => {
      setControlValue(editInputs[0] as HTMLInputElement, "Preview package updated");
      saveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateArtifactMock).toHaveBeenCalledWith("instance_alpha", "artifact_preview", expect.objectContaining({
      label: "Preview package updated",
    }));
  });
});
