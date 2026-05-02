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

vi.mock("../src/api/admin/artifacts", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/artifacts")>("../src/api/admin/artifacts");
  return {
    ...actual,
    fetchArtifacts: fetchArtifactsMock,
    fetchArtifactDetail: fetchArtifactDetailMock,
    createArtifact: createArtifactMock,
    updateArtifact: updateArtifactMock,
  };
});

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

vi.mock("../src/api/admin/workspaces", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/workspaces")>("../src/api/admin/workspaces");
  return {
    ...actual,
    fetchWorkspaces: fetchWorkspacesMock,
    fetchWorkspaceDetail: fetchWorkspaceDetailMock,
    createWorkspace: createWorkspaceMock,
    updateWorkspace: updateWorkspaceMock,
  };
});

import type { AdminSessionUser, ArtifactRecord, WorkspaceDetail, WorkspaceSummary } from "../src/api/domain";
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
    conversation_count: 1,
    task_count: 1,
    approval_count: 1,
    artifact_count: 1,
    latest_conversation_id: "conv_alpha",
    latest_conversation_subject: "Alpha handoff thread",
    next_action_key: "request_review",
    next_action_label: "Request review",
    next_action_state: "available",
    next_action_reason: "Preview evidence is linked. Move the workspace into review.",
    last_activity_at: "2026-04-23T10:05:00Z",
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
    conversations: [
      {
        conversation_id: "conv_alpha",
        subject: "Alpha handoff thread",
        status: "open",
        triage_status: "relevant",
        priority: "high",
        latest_message_at: "2026-04-23T09:58:00Z",
        updated_at: "2026-04-23T10:04:00Z",
      },
    ],
    tasks: [
      {
        task_id: "task_alpha",
        title: "Prepare workspace review",
        status: "open",
        priority: "high",
        owner_id: "user-admin",
        due_at: "2026-04-24T10:00:00Z",
        updated_at: "2026-04-23T10:03:00Z",
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
      {
        event_id: "evt_workspace_review_requested",
        workspace_id: "ws_alpha",
        event_kind: "review_requested",
        note: "Preview evidence linked and review requested.",
        artifact_id: "artifact_preview",
        approval_id: "run:instance_alpha:company_alpha:approval-1",
        run_id: "run_alpha",
        actor_type: "user",
        actor_id: "user-admin",
        created_at: "2026-04-23T10:00:00Z",
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
    scope: "workspace",
    scope_label: "Workspace · preview",
    workspace_role: "preview",
    artifact_type: "preview_link",
    label: "Preview package",
    uri: "https://forgeframe.local/previews/ws_alpha",
    media_type: "text/html",
    preview_url: "https://forgeframe.local/previews/ws_alpha",
    size_bytes: 2048,
    version: "2026.04.23-1",
    checksum_sha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    retention_policy: "workspace_review_30d",
    retained_until: "2026-05-23T09:45:00Z",
    archive_reason: null,
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
      {
        attachment_id: "attach_approval_alpha",
        artifact_id: "artifact_preview",
        target_kind: "approval",
        target_id: "run:instance_alpha:company_alpha:approval-1",
        role: "approval_evidence",
        created_at: "2026-04-23T09:45:00Z",
      },
      {
        attachment_id: "attach_instance_alpha",
        artifact_id: "artifact_preview",
        target_kind: "instance",
        target_id: "instance_alpha",
        role: "instance_scope",
        created_at: "2026-04-23T09:45:00Z",
      },
      {
        attachment_id: "attach_decision_alpha",
        artifact_id: "artifact_preview",
        target_kind: "decision",
        target_id: "decision_alpha",
        role: "decision_context",
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

function getButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
}

function getLabeledControl(scope: ParentNode, labelText: string) {
  const label = Array.from(scope.querySelectorAll("label")).find((candidate) => candidate.textContent?.includes(labelText));
  if (!label) {
    throw new Error(`Label not found: ${labelText}`);
  }
  const control = label.querySelector("input, textarea, select");
  if (!control) {
    throw new Error(`Control not found for label: ${labelText}`);
  }
  return control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
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
    expect(container.textContent).toContain("Workspace inventory");
    expect(container.textContent).toContain("Alpha workspace");
    expect(container.textContent).toContain("Next action");
    expect(container.textContent).toContain("Alpha handoff thread");
    expect(container.textContent).toContain("Prepare workspace review");
    expect(container.textContent).toContain("Handoff history");

    const artifactsLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Workspace artifacts");
    expect(artifactsLink?.getAttribute("href")).toBe("/artifacts?instanceId=instance_alpha&workspaceId=ws_alpha");
  });

  it("creates and updates workspaces against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/workspaces?instanceId=instance_alpha&workspaceId=ws_alpha",
      element: <WorkspacesPage />,
      session: adminSession,
    }));
    await flushEffects();

    await act(async () => {
      getButtonByText(container, "New workspace")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const createForm = container.querySelector("form");

    await act(async () => {
      setControlValue(getLabeledControl(createForm!, "Workspace ID"), "ws_beta");
      setControlValue(getLabeledControl(createForm!, "Title"), "Beta workspace");
      setControlValue(getLabeledControl(createForm!, "Summary"), "New workspace summary");
      getButtonByText(container, "Create workspace")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createWorkspaceMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      workspace_id: "ws_beta",
      title: "Beta workspace",
      summary: "New workspace summary",
      preview_status: "draft",
    }));

    await act(async () => {
      getButtonByText(container, "Edit selected workspace")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const editForm = container.querySelector("form");

    await act(async () => {
      setControlValue(getLabeledControl(editForm!, "Title"), "Alpha workspace updated");
      setControlValue(getLabeledControl(editForm!, "Summary"), "Updated workspace summary");
      setControlValue(getLabeledControl(editForm!, "Handoff reference"), "handoff://pkg/alpha");
      setControlValue(getLabeledControl(editForm!, "Event note"), "Prepared for review handoff.");
      getButtonByText(container, "Save workspace")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateWorkspaceMock).toHaveBeenCalledWith("instance_alpha", "ws_alpha", expect.objectContaining({
      title: "Alpha workspace updated",
      summary: "Updated workspace summary",
      handoff_reference: "handoff://pkg/alpha",
      event_note: "Prepared for review handoff.",
    }));
  });

  it("shows preview and handoff blockers honestly instead of exposing fake lifecycle edits", async () => {
    fetchWorkspacesMock.mockResolvedValueOnce({
      status: "ok",
      instance: null,
      workspaces: [createWorkspaceSummary({
        preview_status: "draft",
        review_status: "not_requested",
        handoff_status: "not_ready",
        active_run_id: null,
        preview_artifact_id: null,
        next_action_key: "start_preview",
        next_action_label: "Start preview",
        next_action_state: "not_ready",
        next_action_reason: "No dedicated preview-start API exists here. Link an execution run or preview artifact first.",
      })],
    });
    fetchWorkspaceDetailMock.mockResolvedValueOnce({
      status: "ok",
      workspace: createWorkspaceDetail({
        preview_status: "draft",
        review_status: "not_requested",
        handoff_status: "not_ready",
        active_run_id: null,
        preview_artifact_id: null,
        next_action_key: "start_preview",
        next_action_label: "Start preview",
        next_action_state: "not_ready",
        next_action_reason: "No dedicated preview-start API exists here. Link an execution run or preview artifact first.",
      }),
    });

    await renderIntoDom(withAppContext({
      path: "/workspaces?instanceId=instance_alpha&workspaceId=ws_alpha",
      element: <WorkspacesPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(container.textContent).toContain("No dedicated preview-start API exists here. Link an execution run or preview artifact first.");
    expect(getButtonByText(container, "Start preview")).toBeUndefined();

    await act(async () => {
      getButtonByText(container, "Edit selected workspace")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const editForm = container.querySelector("form");
    expect(editForm?.querySelectorAll("select").length).toBe(0);
  });

  it("runs the workspace next action when the current status exposes a real transition", async () => {
    await renderIntoDom(withAppContext({
      path: "/workspaces?instanceId=instance_alpha&workspaceId=ws_alpha",
      element: <WorkspacesPage />,
      session: adminSession,
    }));
    await flushEffects();

    await act(async () => {
      getButtonByText(container, "Request review")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateWorkspaceMock).toHaveBeenCalledWith("instance_alpha", "ws_alpha", expect.objectContaining({
      review_status: "pending",
      event_note: "Review requested from workspace surface.",
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
    expect(container.textContent).toContain("Workspace · preview");
    expect(container.textContent).toContain("2026.04.23-1");
    expect(container.textContent).toContain("workspace_review_30d");

    const inventoryRow = container.querySelector('table[aria-label="Artifact inventory"] tbody tr');
    const inventoryLinks = Array.from(inventoryRow?.querySelectorAll("a") ?? []);
    expect(inventoryLinks.some((link) => link.getAttribute("href") === "/workspaces?instanceId=instance_alpha&workspaceId=ws_alpha")).toBe(true);
    expect(inventoryLinks.some((link) => link.getAttribute("href") === "/execution?instanceId=instance_alpha&runId=run_alpha")).toBe(true);
    expect(inventoryLinks.some((link) => link.getAttribute("href") === "/approvals?instanceId=instance_alpha&approvalId=run%3Ainstance_alpha%3Acompany_alpha%3Aapproval-1&status=all")).toBe(true);

    const runLink = Array.from(container.querySelectorAll("a")).find((link) => link.getAttribute("href") === "/execution?instanceId=instance_alpha&runId=run_alpha");
    expect(runLink?.getAttribute("href")).toBe("/execution?instanceId=instance_alpha&runId=run_alpha");
    const downloadLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Download artifact");
    expect(downloadLink?.getAttribute("href")).toBe("https://forgeframe.local/previews/ws_alpha");
  });

  it("shows metadata-only artifact truth when blob delivery is not exposed on this surface", async () => {
    fetchArtifactsMock.mockResolvedValueOnce({
      status: "ok",
      instance: null,
      artifacts: [createArtifactRecord({
        artifact_id: "artifact_note",
        scope_label: "Instance",
        workspace_id: null,
        workspace_role: null,
        artifact_type: "handoff_note",
        label: "Handoff operator note",
        uri: "file:///var/lib/forgeframe/handoff-note.md",
        preview_url: null,
        media_type: "text/markdown",
        version: null,
        checksum_sha256: null,
        retention_policy: null,
        retained_until: null,
        attachments: [],
      })],
    });
    fetchArtifactDetailMock.mockResolvedValueOnce({
      status: "ok",
      artifact: createArtifactRecord({
        artifact_id: "artifact_note",
        scope: "instance",
        scope_label: "Instance",
        workspace_id: null,
        workspace_role: null,
        artifact_type: "handoff_note",
        label: "Handoff operator note",
        uri: "file:///var/lib/forgeframe/handoff-note.md",
        preview_url: null,
        media_type: "text/markdown",
        version: null,
        checksum_sha256: null,
        retention_policy: null,
        retained_until: null,
        attachments: [],
      }),
    });

    await renderIntoDom(withAppContext({
      path: "/artifacts?instanceId=instance_alpha&artifactId=artifact_note",
      element: <ArtifactsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(container.textContent).toContain("metadata-only");
    expect(container.textContent).toContain("does not expose blob delivery");
    const downloadLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Download artifact");
    expect(downloadLink).toBeUndefined();
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
    const createButton = Array.from(createForm?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("Create artifact"));
    const saveButton = Array.from(editForm?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("Save artifact"));

    await act(async () => {
      setControlValue(getLabeledControl(createForm!, "Workspace ID"), "ws_alpha");
      setControlValue(getLabeledControl(createForm!, "Workspace role"), "handoff");
      setControlValue(getLabeledControl(createForm!, "Type"), "handoff_note");
      setControlValue(getLabeledControl(createForm!, "Linked run ID"), "run_alpha");
      setControlValue(getLabeledControl(createForm!, "Linked approval ID"), "run:instance_alpha:company_alpha:approval-1");
      setControlValue(getLabeledControl(createForm!, "Label"), "Handoff note");
      setControlValue(getLabeledControl(createForm!, "URI"), "https://forgeframe.local/handoff/ws_alpha.md");
      setControlValue(getLabeledControl(createForm!, "Version"), "2026.04.24-2");
      setControlValue(getLabeledControl(createForm!, "Checksum (SHA-256)"), "feedface1234");
      setControlValue(getLabeledControl(createForm!, "Retention policy"), "handoff_90d");
      setControlValue(getLabeledControl(createForm!, "Retained until"), "2026-07-24T10:00:00Z");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createArtifactMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      workspace_id: "ws_alpha",
      workspace_role: "handoff",
      label: "Handoff note",
      uri: "https://forgeframe.local/handoff/ws_alpha.md",
      artifact_type: "handoff_note",
      version: "2026.04.24-2",
      checksum_sha256: "feedface1234",
      retention_policy: "handoff_90d",
      retained_until: "2026-07-24T10:00:00Z",
      attachments: [
        { target_kind: "run", target_id: "run_alpha", role: "run_output" },
        { target_kind: "approval", target_id: "run:instance_alpha:company_alpha:approval-1", role: "approval_evidence" },
      ],
    }));

    await act(async () => {
      setControlValue(getLabeledControl(editForm!, "Label"), "Preview package updated");
      setControlValue(getLabeledControl(editForm!, "Preview URL"), "");
      setControlValue(getLabeledControl(editForm!, "Checksum (SHA-256)"), "");
      setControlValue(getLabeledControl(editForm!, "Archive reason"), "Archived after approval closeout");
      saveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateArtifactMock).toHaveBeenCalledWith("instance_alpha", "artifact_preview", expect.objectContaining({
      label: "Preview package updated",
      preview_url: null,
      checksum_sha256: null,
      archive_reason: "Archived after approval closeout",
    }));
  });
});
