// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchContactsMock,
  fetchContactDetailMock,
  createContactMock,
  updateContactMock,
  fetchKnowledgeSourcesMock,
  fetchKnowledgeSourceDetailMock,
  createKnowledgeSourceMock,
  updateKnowledgeSourceMock,
  fetchMemoryEntriesMock,
  fetchMemoryDetailMock,
  createMemoryEntryMock,
  updateMemoryEntryMock,
  correctMemoryEntryMock,
  deleteMemoryEntryMock,
  revokeMemoryEntryMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchContactsMock: vi.fn(),
  fetchContactDetailMock: vi.fn(),
  createContactMock: vi.fn(),
  updateContactMock: vi.fn(),
  fetchKnowledgeSourcesMock: vi.fn(),
  fetchKnowledgeSourceDetailMock: vi.fn(),
  createKnowledgeSourceMock: vi.fn(),
  updateKnowledgeSourceMock: vi.fn(),
  fetchMemoryEntriesMock: vi.fn(),
  fetchMemoryDetailMock: vi.fn(),
  createMemoryEntryMock: vi.fn(),
  updateMemoryEntryMock: vi.fn(),
  correctMemoryEntryMock: vi.fn(),
  deleteMemoryEntryMock: vi.fn(),
  revokeMemoryEntryMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchContacts: fetchContactsMock,
    fetchContactDetail: fetchContactDetailMock,
    createContact: createContactMock,
    updateContact: updateContactMock,
    fetchKnowledgeSources: fetchKnowledgeSourcesMock,
    fetchKnowledgeSourceDetail: fetchKnowledgeSourceDetailMock,
    createKnowledgeSource: createKnowledgeSourceMock,
    updateKnowledgeSource: updateKnowledgeSourceMock,
    fetchMemoryEntries: fetchMemoryEntriesMock,
    fetchMemoryDetail: fetchMemoryDetailMock,
    createMemoryEntry: createMemoryEntryMock,
    updateMemoryEntry: updateMemoryEntryMock,
    correctMemoryEntry: correctMemoryEntryMock,
    deleteMemoryEntry: deleteMemoryEntryMock,
    revokeMemoryEntry: revokeMemoryEntryMock,
  };
});

import type {
  AdminSessionUser,
  ContactDetail,
  ContactSummary,
  KnowledgeSourceDetail,
  KnowledgeSourceSummary,
  MemoryDetail,
  MemorySummary,
} from "../src/api/admin";
import { ContactsPage } from "../src/pages/ContactsPage";
import { KnowledgeSourcesPage } from "../src/pages/KnowledgeSourcesPage";
import { MemoryPage } from "../src/pages/MemoryPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createSourceSummary(overrides: Partial<KnowledgeSourceSummary> = {}): KnowledgeSourceSummary {
  return {
    source_id: "source_mail_primary",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    source_kind: "mail",
    label: "Primary mail connector",
    description: "Inbound email context",
    connection_target: "imap://mail.example.com/inbox",
    status: "active",
    visibility_scope: "team",
    last_synced_at: "2026-04-23T10:00:00Z",
    last_error: null,
    metadata: {},
    contact_count: 1,
    memory_count: 1,
    created_at: "2026-04-23T09:00:00Z",
    updated_at: "2026-04-23T10:00:00Z",
    ...overrides,
  };
}

function createContactSummary(overrides: Partial<ContactSummary> = {}): ContactSummary {
  return {
    contact_id: "contact_alpha",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    contact_ref: "contact://acme/pat",
    source_id: "source_mail_primary",
    display_name: "Pat Morgan",
    primary_email: "pat@example.com",
    primary_phone: "+49-30-555-100",
    organization: "Acme GmbH",
    title: "Operations Lead",
    status: "active",
    visibility_scope: "team",
    metadata: {},
    conversation_count: 1,
    memory_count: 1,
    created_at: "2026-04-23T09:05:00Z",
    updated_at: "2026-04-23T10:05:00Z",
    ...overrides,
  };
}

function createMemorySummary(overrides: Partial<MemorySummary> = {}): MemorySummary {
  return {
    memory_id: "memory_alpha",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    source_id: "source_mail_primary",
    contact_id: "contact_alpha",
    conversation_id: "conversation_alpha",
    task_id: "task_alpha",
    notification_id: "notification_alpha",
    workspace_id: "ws_alpha",
    memory_kind: "preference",
    title: "Pricing preference",
    body: "Customer prefers a reviewed pricing response before send.",
    status: "active",
    truth_state: "active",
    source_trust_class: "operator_verified",
    visibility_scope: "team",
    sensitivity: "sensitive",
    correction_note: null,
    supersedes_memory_id: null,
    learned_from_event_id: "learning_alpha",
    human_override: false,
    expires_at: "2026-04-24T10:00:00Z",
    deleted_at: null,
    metadata: {},
    created_at: "2026-04-23T09:10:00Z",
    updated_at: "2026-04-23T10:10:00Z",
    ...overrides,
  };
}

function createContactDetail(overrides: Partial<ContactDetail> = {}): ContactDetail {
  return {
    ...createContactSummary(),
    source: createSourceSummary(),
    recent_conversations: [
      {
        record_id: "conversation_alpha",
        label: "Pricing review thread",
        status: "open",
      },
    ],
    recent_memory: [createMemorySummary()],
    ...overrides,
  };
}

function createSourceDetail(overrides: Partial<KnowledgeSourceDetail> = {}): KnowledgeSourceDetail {
  return {
    ...createSourceSummary(),
    contacts: [createContactSummary()],
    memory_entries: [createMemorySummary()],
    ...overrides,
  };
}

function createMemoryDetail(overrides: Partial<MemoryDetail> = {}): MemoryDetail {
  return {
    ...createMemorySummary(),
    source: createSourceSummary(),
    contact: createContactSummary(),
    conversation: {
      record_id: "conversation_alpha",
      label: "Pricing review thread",
      status: "open",
    },
    task: {
      record_id: "task_alpha",
      label: "Review outbound pricing",
      status: "open",
    },
    notification: {
      record_id: "notification_alpha",
      label: "Pricing preview",
      status: "preview",
    },
    workspace: {
      record_id: "ws_alpha",
      label: "Pricing workspace",
      status: "previewing",
    },
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

function getControlByLabel(scope: ParentNode, labelText: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const normalizedTarget = labelText.replace(/\s+/g, " ").trim().toLowerCase();
  const label = Array.from(scope.querySelectorAll("label"))
    .map((item) => ({
      element: item,
      text: item.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "",
    }))
    .filter((item) => item.text.startsWith(normalizedTarget))
    .sort((left, right) => left.text.length - right.text.length)[0]?.element;
  const control = label?.querySelector("input, textarea, select");
  if (!control) {
    throw new Error(`Control with label '${labelText}' not found.`);
  }
  return control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}

function getFormByText(text: string) {
  return Array.from(container.querySelectorAll("form")).find((form) => form.textContent?.includes(text));
}

function getButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
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

  fetchContactsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    contacts: [createContactSummary()],
  });
  fetchContactDetailMock.mockResolvedValue({
    status: "ok",
    contact: createContactDetail(),
  });
  createContactMock.mockResolvedValue({
    status: "ok",
    contact: createContactDetail({
      contact_id: "contact_beta",
      display_name: "Jordan Vega",
    }),
  });
  updateContactMock.mockResolvedValue({
    status: "ok",
    contact: createContactDetail({
      display_name: "Pat Morgan Updated",
      organization: "Acme Holding",
    }),
  });

  fetchKnowledgeSourcesMock.mockResolvedValue({
    status: "ok",
    instance: null,
    sources: [createSourceSummary()],
  });
  fetchKnowledgeSourceDetailMock.mockResolvedValue({
    status: "ok",
    source: createSourceDetail(),
  });
  createKnowledgeSourceMock.mockResolvedValue({
    status: "ok",
    source: createSourceDetail({
      source_id: "source_drive_shared",
      source_kind: "drive",
      label: "Shared drive",
    }),
  });
  updateKnowledgeSourceMock.mockResolvedValue({
    status: "ok",
    source: createSourceDetail({
      label: "Primary mail connector updated",
      status: "paused",
    }),
  });

  fetchMemoryEntriesMock.mockResolvedValue({
    status: "ok",
    instance: null,
    memory: [createMemorySummary()],
  });
  fetchMemoryDetailMock.mockResolvedValue({
    status: "ok",
    memory: createMemoryDetail(),
  });
  createMemoryEntryMock.mockResolvedValue({
    status: "ok",
    memory: createMemoryDetail({
      memory_id: "memory_beta",
      title: "Escalation preference",
    }),
  });
  updateMemoryEntryMock.mockResolvedValue({
    status: "ok",
    memory: createMemoryDetail({
      title: "Pricing preference updated",
      correction_note: "Manual refinement",
    }),
  });
  correctMemoryEntryMock.mockResolvedValue({
    status: "ok",
    action: "corrected",
    memory: createMemoryDetail({
      memory_id: "memory_gamma",
      title: "Pricing preference corrected",
      status: "active",
      supersedes_memory_id: "memory_alpha",
      correction_note: "Corrected after operator review",
    }),
  });
  deleteMemoryEntryMock.mockResolvedValue({
    status: "ok",
    action: "deleted",
    memory: createMemoryDetail({
      status: "deleted",
      deleted_at: "2026-04-23T12:00:00Z",
    }),
  });
  revokeMemoryEntryMock.mockResolvedValue({
    status: "ok",
    action: "revoke",
    memory: createMemoryDetail({
      truth_state: "revoked",
      correction_note: "Revoked after operator review",
    }),
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

describe("knowledge and memory pages", () => {
  it("renders the contacts page and creates then updates contact truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/contacts?instanceId=instance_alpha&contactId=contact_alpha",
      element: <ContactsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchContactsMock).toHaveBeenCalledWith("instance_alpha", { status: "all", limit: 100 });
    expect(fetchContactDetailMock).toHaveBeenCalledWith("contact_alpha", "instance_alpha");
    expect(container.textContent).toContain("Pat Morgan");
    expect(container.textContent).toContain("Recent conversations");

    const sourceLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open source");
    expect(sourceLink?.getAttribute("href")).toBe("/knowledge-sources?instanceId=instance_alpha&sourceId=source_mail_primary");

    const createForm = getFormByText("Create contact");
    const editForm = getFormByText("Save contact");
    const createInputs = Array.from(createForm?.querySelectorAll("input") ?? []);
    const createSelects = Array.from(createForm?.querySelectorAll("select") ?? []);
    const createButton = getButtonByText(createForm!, "Create contact");

    await act(async () => {
      setControlValue(createInputs[0] as HTMLInputElement, "contact_beta");
      setControlValue(createInputs[1] as HTMLInputElement, "contact://acme/jordan");
      setControlValue(createInputs[2] as HTMLInputElement, "source_mail_primary");
      setControlValue(createInputs[3] as HTMLInputElement, "Jordan Vega");
      setControlValue(createInputs[4] as HTMLInputElement, "jordan@example.com");
      setControlValue(createInputs[5] as HTMLInputElement, "+49-30-555-200");
      setControlValue(createInputs[6] as HTMLInputElement, "Beta GmbH");
      setControlValue(createInputs[7] as HTMLInputElement, "Director");
      setControlValue(createSelects[0] as HTMLSelectElement, "active");
      setControlValue(createSelects[1] as HTMLSelectElement, "team");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createContactMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      contact_id: "contact_beta",
      contact_ref: "contact://acme/jordan",
      source_id: "source_mail_primary",
      display_name: "Jordan Vega",
      primary_email: "jordan@example.com",
      primary_phone: "+49-30-555-200",
      organization: "Beta GmbH",
      title: "Director",
      status: "active",
      visibility_scope: "team",
    }));

    const editInputs = Array.from(editForm?.querySelectorAll("input") ?? []);
    const editSelects = Array.from(editForm?.querySelectorAll("select") ?? []);
    const editButton = getButtonByText(editForm!, "Save contact");

    await act(async () => {
      setControlValue(editInputs[0] as HTMLInputElement, "contact://acme/pat-updated");
      setControlValue(editInputs[1] as HTMLInputElement, "source_mail_primary");
      setControlValue(editInputs[2] as HTMLInputElement, "Pat Morgan Updated");
      setControlValue(editInputs[3] as HTMLInputElement, "pat-updated@example.com");
      setControlValue(editInputs[4] as HTMLInputElement, "+49-30-555-999");
      setControlValue(editInputs[5] as HTMLInputElement, "Acme Holding");
      setControlValue(editInputs[6] as HTMLInputElement, "VP Operations");
      setControlValue(editSelects[0] as HTMLSelectElement, "snoozed");
      setControlValue(editSelects[1] as HTMLSelectElement, "restricted");
      editButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateContactMock).toHaveBeenCalledWith("instance_alpha", "contact_alpha", expect.objectContaining({
      contact_ref: "contact://acme/pat-updated",
      display_name: "Pat Morgan Updated",
      primary_email: "pat-updated@example.com",
      primary_phone: "+49-30-555-999",
      organization: "Acme Holding",
      title: "VP Operations",
      status: "snoozed",
      visibility_scope: "restricted",
    }));
  });

  it("renders the knowledge-sources page and creates then updates source truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/knowledge-sources?instanceId=instance_alpha&sourceId=source_mail_primary",
      element: <KnowledgeSourcesPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchKnowledgeSourcesMock).toHaveBeenCalledWith("instance_alpha", {
      sourceKind: "all",
      status: "all",
      limit: 100,
    });
    expect(fetchKnowledgeSourceDetailMock).toHaveBeenCalledWith("source_mail_primary", "instance_alpha");
    expect(container.textContent).toContain("Primary mail connector");
    expect(container.textContent).toContain("Linked contacts");

    const contactLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Pat Morgan");
    expect(contactLink?.getAttribute("href")).toBe("/contacts?instanceId=instance_alpha&contactId=contact_alpha");

    const createForm = getFormByText("Create knowledge source");
    const editForm = getFormByText("Save knowledge source");
    const createInputs = Array.from(createForm?.querySelectorAll("input") ?? []);
    const createTextareas = Array.from(createForm?.querySelectorAll("textarea") ?? []);
    const createSelects = Array.from(createForm?.querySelectorAll("select") ?? []);
    const createButton = getButtonByText(createForm!, "Create knowledge source");

    await act(async () => {
      setControlValue(createInputs[0] as HTMLInputElement, "source_drive_shared");
      setControlValue(createSelects[0] as HTMLSelectElement, "drive");
      setControlValue(createSelects[1] as HTMLSelectElement, "active");
      setControlValue(createInputs[1] as HTMLInputElement, "Shared drive");
      setControlValue(createInputs[2] as HTMLInputElement, "https://drive.example.com/shared");
      setControlValue(createSelects[2] as HTMLSelectElement, "team");
      setControlValue(createTextareas[0] as HTMLTextAreaElement, "Shared working files");
      setControlValue(createInputs[3] as HTMLInputElement, "2026-04-23T11:00:00Z");
      setControlValue(createInputs[4] as HTMLInputElement, "Optional issue");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createKnowledgeSourceMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      source_id: "source_drive_shared",
      source_kind: "drive",
      label: "Shared drive",
      description: "Shared working files",
      connection_target: "https://drive.example.com/shared",
      status: "active",
      visibility_scope: "team",
      last_synced_at: "2026-04-23T11:00:00Z",
      last_error: "Optional issue",
    }));

    const editInputs = Array.from(editForm?.querySelectorAll("input") ?? []);
    const editTextareas = Array.from(editForm?.querySelectorAll("textarea") ?? []);
    const editSelects = Array.from(editForm?.querySelectorAll("select") ?? []);
    const editButton = getButtonByText(editForm!, "Save knowledge source");

    await act(async () => {
      setControlValue(editInputs[0] as HTMLInputElement, "Primary mail connector updated");
      setControlValue(editInputs[1] as HTMLInputElement, "imap://mail.example.com/archive");
      setControlValue(editSelects[0] as HTMLSelectElement, "paused");
      setControlValue(editTextareas[0] as HTMLTextAreaElement, "Inbound email context updated");
      setControlValue(editSelects[1] as HTMLSelectElement, "restricted");
      setControlValue(editInputs[2] as HTMLInputElement, "2026-04-23T12:00:00Z");
      setControlValue(editInputs[3] as HTMLInputElement, "Probe degraded");
      editButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateKnowledgeSourceMock).toHaveBeenCalledWith("instance_alpha", "source_mail_primary", expect.objectContaining({
      label: "Primary mail connector updated",
      description: "Inbound email context updated",
      connection_target: "imap://mail.example.com/archive",
      status: "paused",
      visibility_scope: "restricted",
      last_synced_at: "2026-04-23T12:00:00Z",
      last_error: "Probe degraded",
    }));
  });

  it("renders the memory page and runs create, update, correction, and deletion flows", async () => {
    await renderIntoDom(withAppContext({
      path: "/memory?instanceId=instance_alpha&memoryId=memory_alpha",
      element: <MemoryPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchMemoryEntriesMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      visibilityScope: "all",
      limit: 100,
    });
    expect(fetchMemoryDetailMock).toHaveBeenCalledWith("memory_alpha", "instance_alpha");
    expect(container.textContent).toContain("Pricing preference");
    expect(container.textContent).toContain("Delete memory");
    expect(container.textContent).toContain("Truth maintenance");

    const taskLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open task");
    expect(taskLink?.getAttribute("href")).toBe("/tasks?instanceId=instance_alpha&taskId=task_alpha");
    const learningLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open learning event");
    expect(learningLink?.getAttribute("href")).toBe("/learning?instanceId=instance_alpha&eventId=learning_alpha");

    const createForm = getFormByText("Create memory entry");
    const saveForm = getFormByText("Save memory");
    const correctForm = getFormByText("Correct memory");
    const deleteForm = getFormByText("Delete memory");
    const revokeForm = getFormByText("Revoke memory");

    const createButton = getButtonByText(createForm!, "Create memory entry");

    await act(async () => {
      setControlValue(getControlByLabel(createForm, "Memory ID"), "memory_beta");
      setControlValue(getControlByLabel(createForm, "Source ID"), "source_mail_primary");
      setControlValue(getControlByLabel(createForm, "Contact ID"), "contact_alpha");
      setControlValue(getControlByLabel(createForm, "Conversation ID"), "conversation_alpha");
      setControlValue(getControlByLabel(createForm, "Task ID"), "task_alpha");
      setControlValue(getControlByLabel(createForm, "Notification ID"), "notification_alpha");
      setControlValue(getControlByLabel(createForm, "Workspace ID"), "ws_alpha");
      setControlValue(getControlByLabel(createForm, "Memory kind"), "constraint");
      setControlValue(getControlByLabel(createForm, "Visibility"), "restricted");
      setControlValue(getControlByLabel(createForm, "Sensitivity"), "restricted");
      setControlValue(getControlByLabel(createForm, "Expires at"), "2026-04-25T10:00:00Z");
      setControlValue(getControlByLabel(createForm, "Title"), "Escalation preference");
      setControlValue(getControlByLabel(createForm, "Correction note"), "Initial note");
      setControlValue(getControlByLabel(createForm, "Body"), "Escalate if no approval arrives by noon.");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createMemoryEntryMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      memory_id: "memory_beta",
      source_id: "source_mail_primary",
      contact_id: "contact_alpha",
      conversation_id: "conversation_alpha",
      task_id: "task_alpha",
      notification_id: "notification_alpha",
      workspace_id: "ws_alpha",
      memory_kind: "constraint",
      title: "Escalation preference",
      body: "Escalate if no approval arrives by noon.",
      visibility_scope: "restricted",
      sensitivity: "restricted",
      correction_note: "Initial note",
      expires_at: "2026-04-25T10:00:00Z",
    }));

    const saveButton = getButtonByText(saveForm!, "Save memory");

    await act(async () => {
      setControlValue(getControlByLabel(saveForm, "Source ID"), "source_mail_primary");
      setControlValue(getControlByLabel(saveForm, "Contact ID"), "contact_alpha");
      setControlValue(getControlByLabel(saveForm, "Conversation ID"), "conversation_alpha");
      setControlValue(getControlByLabel(saveForm, "Task ID"), "task_alpha");
      setControlValue(getControlByLabel(saveForm, "Notification ID"), "notification_alpha");
      setControlValue(getControlByLabel(saveForm, "Workspace ID"), "ws_alpha");
      setControlValue(getControlByLabel(saveForm, "Memory kind"), "summary");
      setControlValue(getControlByLabel(saveForm, "Visibility"), "team");
      setControlValue(getControlByLabel(saveForm, "Sensitivity"), "sensitive");
      setControlValue(getControlByLabel(saveForm, "Expires at"), "2026-04-26T09:00:00Z");
      setControlValue(getControlByLabel(saveForm, "Correction note"), "Manual refinement");
      setControlValue(getControlByLabel(saveForm, "Title"), "Pricing preference updated");
      setControlValue(getControlByLabel(saveForm, "Body"), "Updated memory after operator review.");
      saveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateMemoryEntryMock).toHaveBeenCalledWith("instance_alpha", "memory_alpha", expect.objectContaining({
      memory_kind: "summary",
      title: "Pricing preference updated",
      body: "Updated memory after operator review.",
      visibility_scope: "team",
      sensitivity: "sensitive",
      correction_note: "Manual refinement",
      expires_at: "2026-04-26T09:00:00Z",
    }));

    const correctButton = getButtonByText(correctForm!, "Correct memory");

    await act(async () => {
      setControlValue(getControlByLabel(correctForm, "Title"), "Pricing preference corrected");
      setControlValue(getControlByLabel(correctForm, "Body"), "Corrected context body.");
      setControlValue(getControlByLabel(correctForm, "Correction note"), "Corrected after operator review");
      setControlValue(getControlByLabel(correctForm, "Memory kind"), "preference");
      setControlValue(getControlByLabel(correctForm, "Visibility"), "restricted");
      setControlValue(getControlByLabel(correctForm, "Sensitivity"), "restricted");
      setControlValue(getControlByLabel(correctForm, "Expires at"), "2026-04-27T09:00:00Z");
      correctButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(correctMemoryEntryMock).toHaveBeenCalledWith("instance_alpha", "memory_alpha", expect.objectContaining({
      title: "Pricing preference corrected",
      body: "Corrected context body.",
      correction_note: "Corrected after operator review",
      memory_kind: "preference",
      visibility_scope: "restricted",
      sensitivity: "restricted",
      expires_at: "2026-04-27T09:00:00Z",
    }));

    const deleteButton = getButtonByText(deleteForm!, "Delete memory");

    await act(async () => {
      setControlValue(getControlByLabel(deleteForm, "Deletion note"), "Memory no longer valid");
      deleteButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(deleteMemoryEntryMock).toHaveBeenCalledWith("instance_alpha", "memory_alpha", {
      deletion_note: "Memory no longer valid",
    });

    const revokeButton = getButtonByText(revokeForm!, "Revoke memory");

    await act(async () => {
      setControlValue(getControlByLabel(revokeForm!, "Revocation note"), "Memory derived from invalid source");
      revokeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(revokeMemoryEntryMock).toHaveBeenCalledWith("instance_alpha", "memory_alpha", {
      revocation_note: "Memory derived from invalid source",
    });
  });
});
