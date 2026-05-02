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

vi.mock("../src/api/admin/contacts", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/contacts")>("../src/api/admin/contacts");
  return {
    ...actual,
    fetchContacts: fetchContactsMock,
    fetchContactDetail: fetchContactDetailMock,
    createContact: createContactMock,
    updateContact: updateContactMock,
  };
});

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

vi.mock("../src/api/admin/knowledge-sources", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/knowledge-sources")>("../src/api/admin/knowledge-sources");
  return {
    ...actual,
    fetchKnowledgeSources: fetchKnowledgeSourcesMock,
    fetchKnowledgeSourceDetail: fetchKnowledgeSourceDetailMock,
    createKnowledgeSource: createKnowledgeSourceMock,
    updateKnowledgeSource: updateKnowledgeSourceMock,
  };
});

vi.mock("../src/api/admin/memory", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/memory")>("../src/api/admin/memory");
  return {
    ...actual,
    fetchMemoryEntries: fetchMemoryEntriesMock,
    fetchMemoryDetail: fetchMemoryDetailMock,
    createMemoryEntry: createMemoryEntryMock,
    updateMemoryEntry: updateMemoryEntryMock,
    correctMemoryEntry: correctMemoryEntryMock,
    deleteMemoryEntry: deleteMemoryEntryMock,
    revokeMemoryEntry: revokeMemoryEntryMock,
  };
});

vi.mock("../src/api/domain", async () => {
  const actual = await vi.importActual<typeof import("../src/api/domain")>("../src/api/domain");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
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
} from "../src/api/domain";
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
    scope_label: "tenant knowledge",
    last_synced_at: "2026-04-23T10:00:00Z",
    last_error: null,
    sync: {
      state: "synced",
      next_step: "Use this source for recall, then promote verified durable facts into Memory when they must survive connector drift.",
      action_available: false,
      action_state: "missing-runtime-state",
      action_reason: "Backend does not expose a dedicated knowledge-source sync endpoint.",
    },
    metadata: {
      connector: {
        account: "ops@example.com",
        collection: "INBOX/Customers",
        index_mode: "subject+body",
      },
      knowledge_boundary: {
        recall_class: "customer recall",
        scope_note: "Tenant-shared sales knowledge",
      },
      error_guidance: {
        next_step: "Refresh connector credentials and re-run bridge sync",
      },
    },
    contact_count: 1,
    memory_count: 1,
    indexed_objects: {
      contacts: 1,
      durable_memory: 1,
      linked_conversations: 1,
      linked_skills: 1,
    },
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
    source_label: "Primary mail connector",
    source_kind: "mail",
    display_name: "Pat Morgan",
    primary_email: "pat@example.com",
    primary_phone: "+49-30-555-100",
    organization: "Acme GmbH",
    title: "Operations Lead",
    status: "active",
    visibility_scope: "team",
    metadata: {},
    channels: [
      {
        kind: "email",
        label: "Primary email",
        address: "pat@example.com",
        is_primary: true,
        source: "contact profile",
        route_status: "reachable",
        warning: null,
      },
      {
        kind: "phone",
        label: "Primary phone",
        address: "+49-30-555-100",
        is_primary: true,
        source: "contact profile",
        route_status: "reachable",
        warning: null,
      },
      {
        kind: "slack",
        label: "Escalation slack",
        address: "@pat-morgan",
        is_primary: false,
        source: "crm-sync",
        route_status: "reachable",
        warning: null,
      },
      {
        kind: "email",
        label: "Escalation mailbox",
        address: "[missing address]",
        is_primary: false,
        source: "metadata",
        route_status: "warning",
        warning: "Escalation mailbox is missing an address.",
      },
    ],
    reachable_channel_count: 3,
    route_warnings: ["Escalation mailbox is missing an address."],
    conversation_count: 1,
    memory_count: 1,
    last_contact_at: "2026-04-23T10:20:00Z",
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
    source_label: "Primary mail connector",
    source_kind: "mail",
    contact_id: "contact_alpha",
    conversation_id: "conversation_alpha",
    task_id: "task_alpha",
    notification_id: "notification_alpha",
    workspace_id: "ws_alpha",
    memory_kind: "preference",
    title: "Pricing preference",
    body: "Customer prefers a reviewed pricing response before send.",
    memory_layer: "working",
    memory_layer_label: "Working Context Reference",
    status: "active",
    truth_state: "active",
    source_trust_class: "runtime_inferred",
    visibility_scope: "team",
    sensitivity: "sensitive",
    review: {
      review_at: "2026-04-25T10:00:00Z",
      state: "scheduled",
      note: "Review inferred pricing truth after operator confirmation.",
      rationale: "A future review checkpoint is scheduled for this memory entry.",
    },
    last_used_at: "2026-04-23T10:40:00Z",
    usage: {
      runs: 1,
      conversations: 1,
      skills: 1,
    },
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
    ...createContactSummary({
      metadata: {
        channels: [
          { kind: "slack", label: "Escalation slack", address: "@pat-morgan", source: "crm-sync" },
          { kind: "email", label: "Escalation mailbox" },
        ],
        provenance: {
          provider: "crm",
          import_reference: "crm-4471",
          imported_at: "2026-04-23T09:30:00Z",
          last_verified_at: "2026-04-23T10:15:00Z",
          note: "Imported from the CRM owner directory.",
        },
        consent: {
          status: "explicit_opt_in",
          captured_at: "2026-04-23T09:40:00Z",
          note: "Approved for pricing follow-up.",
        },
        visibility: {
          note: "Shared with the sales response team.",
        },
      },
    }),
    source: createSourceSummary(),
    provenance: {
      provider: "crm",
      import_reference: "crm-4471",
      imported_at: "2026-04-23T09:30:00Z",
      last_verified_at: "2026-04-23T10:15:00Z",
      note: "Imported from the CRM owner directory.",
    },
    consent: {
      status: "explicit_opt_in",
      captured_at: "2026-04-23T09:40:00Z",
      note: "Approved for pricing follow-up.",
    },
    visibility_note: "Shared with the sales response team.",
    recent_conversations: [
      {
        record_id: "conversation_alpha",
        label: "Pricing review thread",
        status: "open",
      },
    ],
    recent_tasks: [
      {
        record_id: "task_alpha",
        label: "Review outbound pricing",
        status: "open",
      },
    ],
    recent_notifications: [
      {
        record_id: "notification_alpha",
        label: "Pricing preview",
        status: "preview",
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
    connector_fields: [
      {
        key: "connection_target",
        label: "Mailbox target",
        value: "imap://mail.example.com/inbox",
        note: null,
        redacted: false,
      },
      {
        key: "connector_account",
        label: "Connector account",
        value: "ops@example.com",
        note: null,
        redacted: false,
      },
      {
        key: "connector_collection",
        label: "Collection / folder",
        value: "INBOX/Customers",
        note: null,
        redacted: false,
      },
      {
        key: "index_mode",
        label: "Index mode",
        value: "subject+body",
        note: null,
        redacted: false,
      },
      {
        key: "recall_class",
        label: "Recall class",
        value: "customer recall",
        note: null,
        redacted: false,
      },
      {
        key: "scope_note",
        label: "Scope note",
        value: "Tenant-shared sales knowledge",
        note: null,
        redacted: false,
      },
    ],
    linked_conversations: [
      {
        record_id: "conversation_alpha",
        label: "Pricing review thread",
        status: "open",
      },
    ],
    linked_skills: [
      {
        record_id: "skill_alpha",
        label: "Pricing response guardrail",
        status: "active",
      },
    ],
    recall_vs_memory_note: "Source recall stays connector-backed and can drift after the next sync. Durable Memory is the governed, operator-correctable layer for facts that must outlive connector state.",
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
    revision_history: [
      {
        memory_id: "memory_seed",
        title: "Pricing preference seed",
        status: "corrected",
        truth_state: "superseded",
        source_trust_class: "operator_verified",
        correction_note: "Superseded by reviewed memory.",
        created_at: "2026-04-23T08:50:00Z",
        updated_at: "2026-04-23T09:20:00Z",
      },
      {
        memory_id: "memory_alpha",
        title: "Pricing preference",
        status: "active",
        truth_state: "active",
        source_trust_class: "runtime_inferred",
        correction_note: null,
        created_at: "2026-04-23T09:10:00Z",
        updated_at: "2026-04-23T10:10:00Z",
      },
    ],
    usage_runs: [
      {
        record_id: "run_alpha",
        label: "Run run_alpha",
        status: "succeeded",
      },
    ],
    usage_conversations: [
      {
        record_id: "conversation_alpha",
        label: "Pricing review thread",
        status: "open",
      },
    ],
    usage_skills: [
      {
        record_id: "skill_alpha",
        label: "Pricing response guardrail",
        status: "active",
      },
    ],
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
    memory: [
      createMemorySummary(),
      createMemorySummary({
        memory_id: "memory_durable",
        title: "Durable pricing truth",
        body: "Approved and durable pricing rule.",
        conversation_id: null,
        task_id: null,
        notification_id: null,
        workspace_id: null,
        learned_from_event_id: null,
        memory_layer: "durable",
        memory_layer_label: "Durable Memory",
        source_trust_class: "operator_verified",
        review: {
          review_at: null,
          state: "not_required",
          note: null,
          rationale: "No additional review checkpoint is currently required.",
        },
        usage: {
          runs: 0,
          conversations: 0,
          skills: 1,
        },
        last_used_at: "2026-04-23T10:15:00Z",
      }),
      createMemorySummary({
        memory_id: "memory_boot",
        title: "Boot candidate follow-up",
        body: "Boot memory candidate waiting for durable review.",
        conversation_id: null,
        task_id: null,
        notification_id: null,
        workspace_id: null,
        learned_from_event_id: "learning_boot",
        memory_layer: "boot",
        memory_layer_label: "Boot Memory Candidate",
        review: {
          review_at: "2026-04-25T09:00:00Z",
          state: "scheduled",
          note: "Promoted from learning and awaiting durable review.",
          rationale: "A future review checkpoint is scheduled for this memory entry.",
        },
        usage: {
          runs: 0,
          conversations: 0,
          skills: 0,
        },
        last_used_at: null,
      }),
      createMemorySummary({
        memory_id: "memory_revoked",
        title: "Revoked stale fact",
        body: "Stale runtime-derived fact.",
        conversation_id: null,
        task_id: null,
        notification_id: null,
        workspace_id: null,
        memory_layer: "durable",
        memory_layer_label: "Durable Memory",
        status: "active",
        truth_state: "revoked",
        source_trust_class: "external_unverified",
        review: {
          review_at: null,
          state: "required",
          note: "Revoked after invalid runtime evidence.",
          rationale: "Runtime-inferred or externally unverified memory requires an explicit review before it should be trusted as durable truth.",
        },
        usage: {
          runs: 0,
          conversations: 0,
          skills: 0,
        },
        last_used_at: null,
      }),
    ],
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
    expect(container.textContent).toContain("Linked work records");
    expect(container.textContent).toContain("Escalation mailbox is missing an address.");
    expect(container.textContent).toContain("Pricing preview");
    expect(container.textContent).toContain("Review outbound pricing");

    const sourceLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open source");
    expect(sourceLink?.getAttribute("href")).toBe("/knowledge-sources?instanceId=instance_alpha&sourceId=source_mail_primary");
    const notificationLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Pricing preview");
    expect(notificationLink?.getAttribute("href")).toBe("/notifications?instanceId=instance_alpha&notificationId=notification_alpha");

    // Make mock return a valid response so the create flow completes cleanly
    createContactMock.mockResolvedValue({
      status: "success",
      contact: { contact_id: "contact_beta", display_name: "Jordan Vega" },
    });

    // Click the hero "Create contact" button to show the guided creation form
    const heroCreateButton = getButtonByText(container, "Create contact");
    await act(async () => {
      heroCreateButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const createForm = getFormByText("Create contact");
    const createButton = getButtonByText(createForm!, "Create contact");

    await act(async () => {
      setControlValue(getControlByLabel(createForm!, "Contact ID"), "contact_beta");
      setControlValue(getControlByLabel(createForm!, "Contact path"), "contact://acme/jordan");
      setControlValue(getControlByLabel(createForm!, "Source"), "source_mail_primary");
      setControlValue(getControlByLabel(createForm!, "Display name"), "Jordan Vega");
      setControlValue(getControlByLabel(createForm!, "Organization"), "Beta GmbH");
      setControlValue(getControlByLabel(createForm!, "Title"), "Director");
      setControlValue(getControlByLabel(createForm!, "Primary email"), "jordan@example.com");
      setControlValue(getControlByLabel(createForm!, "Secondary email"), "sales@example.com");
      setControlValue(getControlByLabel(createForm!, "Slack handle"), "@jordan-vega");
      setControlValue(getControlByLabel(createForm!, "Primary phone"), "+49-30-555-200");
      setControlValue(getControlByLabel(createForm!, "Secondary phone"), "+49-30-555-201");
      setControlValue(getControlByLabel(createForm!, "Status"), "active");
      setControlValue(getControlByLabel(createForm!, "Visibility scope"), "team");
      setControlValue(getControlByLabel(createForm!, "Consent status"), "explicit_opt_in");
      setControlValue(getControlByLabel(createForm!, "Consent date"), "2026-04-24T11:00:00Z");
      setControlValue(getControlByLabel(createForm!, "Consent note"), "Approved for sales outreach");
      setControlValue(getControlByLabel(createForm!, "Visibility note"), "Shared with revenue operations");
      setControlValue(getControlByLabel(createForm!, "Source provider"), "crm");
      setControlValue(getControlByLabel(createForm!, "Import ID"), "crm-778");
      setControlValue(getControlByLabel(createForm!, "Imported at"), "2026-04-24T10:30:00Z");
      setControlValue(getControlByLabel(createForm!, "Last verified"), "2026-04-24T10:45:00Z");
      setControlValue(getControlByLabel(createForm!, "Provenance note"), "Imported from CRM sync");
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
      metadata: {
        channels: [
          { kind: "email", label: "Secondary email", address: "sales@example.com", source: "operator" },
          { kind: "phone", label: "Secondary phone", address: "+49-30-555-201", source: "operator" },
          { kind: "slack", label: "Slack", address: "@jordan-vega", source: "operator" },
        ],
        consent: {
          status: "explicit_opt_in",
          captured_at: "2026-04-24T11:00:00Z",
          note: "Approved for sales outreach",
        },
        provenance: {
          provider: "crm",
          import_reference: "crm-778",
          imported_at: "2026-04-24T10:30:00Z",
          last_verified_at: "2026-04-24T10:45:00Z",
          note: "Imported from CRM sync",
        },
        visibility: {
          note: "Shared with revenue operations",
        },
      },
    }));

    // Click "Edit contact" in the detail panel to reveal the edit form
    const editContactButton = getButtonByText(container, "Edit contact");
    await act(async () => {
      editContactButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const editForm = getFormByText("Save contact");
    const editButton = getButtonByText(editForm!, "Save contact");

    // Make mock return a valid response so the save flow completes cleanly
    updateContactMock.mockResolvedValue({
      status: "success",
      contact: { contact_id: "contact_alpha" },
    });

    await act(async () => {
      setControlValue(getControlByLabel(editForm!, "Contact path"), "contact://acme/pat-updated");
      setControlValue(getControlByLabel(editForm!, "Source"), "source_mail_primary");
      setControlValue(getControlByLabel(editForm!, "Display name"), "Pat Morgan Updated");
      setControlValue(getControlByLabel(editForm!, "Organization"), "Acme Holding");
      setControlValue(getControlByLabel(editForm!, "Title"), "VP Operations");
      setControlValue(getControlByLabel(editForm!, "Primary email"), "pat-updated@example.com");
      setControlValue(getControlByLabel(editForm!, "Secondary email"), "ops-updated@example.com");
      setControlValue(getControlByLabel(editForm!, "Slack handle"), "@pat-updated");
      setControlValue(getControlByLabel(editForm!, "Primary phone"), "+49-30-555-999");
      setControlValue(getControlByLabel(editForm!, "Secondary phone"), "+49-30-555-998");
      setControlValue(getControlByLabel(editForm!, "Status"), "snoozed");
      setControlValue(getControlByLabel(editForm!, "Visibility scope"), "restricted");
      setControlValue(getControlByLabel(editForm!, "Consent status"), "opted_out");
      setControlValue(getControlByLabel(editForm!, "Consent date"), "2026-04-25T09:00:00Z");
      setControlValue(getControlByLabel(editForm!, "Consent note"), "Opted out of outbound mail");
      setControlValue(getControlByLabel(editForm!, "Source provider"), "crm");
      setControlValue(getControlByLabel(editForm!, "Import ID"), "crm-4471-updated");
      setControlValue(getControlByLabel(editForm!, "Imported at"), "2026-04-25T08:45:00Z");
      setControlValue(getControlByLabel(editForm!, "Last verified"), "2026-04-25T08:55:00Z");
      setControlValue(getControlByLabel(editForm!, "Provenance note"), "Updated after CRM review");
      setControlValue(getControlByLabel(editForm!, "Visibility note"), "Restricted to senior operators");
      editButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateContactMock).toHaveBeenCalledWith("instance_alpha", "contact_alpha", expect.objectContaining({
      contact_ref: "contact://acme/pat-updated",
      source_id: "source_mail_primary",
      display_name: "Pat Morgan Updated",
      primary_email: "pat-updated@example.com",
      primary_phone: "+49-30-555-999",
      organization: "Acme Holding",
      title: "VP Operations",
      status: "snoozed",
      visibility_scope: "restricted",
      metadata: {
        channels: [
          { kind: "email", label: "Escalation mailbox" },
          { kind: "email", label: "Secondary email", address: "ops-updated@example.com", source: "operator" },
          { kind: "phone", label: "Secondary phone", address: "+49-30-555-998", source: "operator" },
          { kind: "slack", label: "Slack", address: "@pat-updated", source: "operator" },
        ],
        consent: {
          status: "opted_out",
          captured_at: "2026-04-25T09:00:00Z",
          note: "Opted out of outbound mail",
        },
        provenance: {
          provider: "crm",
          import_reference: "crm-4471-updated",
          imported_at: "2026-04-25T08:45:00Z",
          last_verified_at: "2026-04-25T08:55:00Z",
          note: "Updated after CRM review",
        },
        visibility: {
          note: "Restricted to senior operators",
        },
      },
    }));

    // Re-query after re-render from the first save
    const editForm2 = getFormByText("Save contact");
    const editButton2 = getButtonByText(editForm2!, "Save contact");

    await act(async () => {
      setControlValue(getControlByLabel(editForm2!, "Source"), "");
      setControlValue(getControlByLabel(editForm2!, "Primary email"), "");
      setControlValue(getControlByLabel(editForm2!, "Primary phone"), "");
      editButton2!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateContactMock).toHaveBeenNthCalledWith(2, "instance_alpha", "contact_alpha", expect.objectContaining({
      source_id: null,
      primary_email: null,
      primary_phone: null,
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
    expect(container.textContent).toContain("tenant knowledge");
    expect(container.textContent).toContain("missing-runtime-state");
    expect(container.textContent).toContain("Pricing response guardrail");
    expect(container.textContent).toContain("Source recall stays connector-backed");

    const contactLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Pat Morgan");
    expect(contactLink?.getAttribute("href")).toBe("/contacts?instanceId=instance_alpha&contactId=contact_alpha");
    const skillLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Pricing response guardrail");
    expect(skillLink?.getAttribute("href")).toBe("/skills?instanceId=instance_alpha&skillId=skill_alpha");
    const memoryLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open durable memory");
    expect(memoryLink?.getAttribute("href")).toBe("/memory?instanceId=instance_alpha");

    // Click the hero "Create knowledge source" button to show the create form
    const heroCreateButton = getButtonByText(container, "Create knowledge source");
    expect(heroCreateButton).toBeTruthy();
    await act(async () => {
      heroCreateButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const createForm = getFormByText("Create knowledge source");
    const createButton = getButtonByText(createForm!, "Create knowledge source");

    await act(async () => {
      setControlValue(getControlByLabel(createForm!, "Source ID (optional)"), "source_drive_shared");
      setControlValue(getControlByLabel(createForm!, "Source type"), "drive");
      setControlValue(getControlByLabel(createForm!, "Status"), "active");
      setControlValue(getControlByLabel(createForm!, "Label"), "Shared drive");
      setControlValue(getControlByLabel(createForm!, "Visibility scope"), "team");
      setControlValue(getControlByLabel(createForm!, "Library target"), "https://drive.example.com/shared");
      setControlValue(getControlByLabel(createForm!, "Drive account"), "drive-sync@example.com");
      setControlValue(getControlByLabel(createForm!, "Root folder"), "/pricing");
      setControlValue(getControlByLabel(createForm!, "What should be indexed"), "metadata-only");
      setControlValue(getControlByLabel(createForm!, "How this source is used in recall"), "reference recall");
      setControlValue(getControlByLabel(createForm!, "Scope note"), "Tenant-shared pricing documents");
      setControlValue(getControlByLabel(createForm!, "Suggested repair action"), "Refresh drive token and re-run bridge sync");
      setControlValue(getControlByLabel(createForm!, "Description"), "Shared working files");
      setControlValue(getControlByLabel(createForm!, "Last synced at"), "2026-04-23T11:00:00Z");
      setControlValue(getControlByLabel(createForm!, "Last error"), "Optional issue");
      setControlValue(getControlByLabel(createForm!, "Advanced metadata JSON"), "{\n  \"retention\": \"30d\"\n}");
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
      metadata: {
        retention: "30d",
        connector: {
          account: "drive-sync@example.com",
          collection: "/pricing",
          index_mode: "metadata-only",
        },
        knowledge_boundary: {
          recall_class: "reference recall",
          scope_note: "Tenant-shared pricing documents",
        },
        error_guidance: {
          next_step: "Refresh drive token and re-run bridge sync",
        },
      },
    }));

    // Click "Edit source" to show the edit form
    const editSourceButton = getButtonByText(container, "Edit source");
    expect(editSourceButton).toBeTruthy();
    await act(async () => {
      editSourceButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const editForm = getFormByText("Save knowledge source");
    const editButton = getButtonByText(editForm!, "Save knowledge source");

    await act(async () => {
      setControlValue(getControlByLabel(editForm!, "Label"), "Primary mail connector updated");
      setControlValue(getControlByLabel(editForm!, "Status"), "paused");
      setControlValue(getControlByLabel(editForm!, "Visibility scope"), "restricted");
      setControlValue(getControlByLabel(editForm!, "Mailbox or inbox path"), "imap://mail.example.com/archive");
      setControlValue(getControlByLabel(editForm!, "Mailbox account"), "mail-ops@example.com");
      setControlValue(getControlByLabel(editForm!, "Folder / label"), "Archive/Customers");
      setControlValue(getControlByLabel(editForm!, "What should be indexed"), "headers-only");
      setControlValue(getControlByLabel(editForm!, "How this source is used in recall"), "operator recall");
      setControlValue(getControlByLabel(editForm!, "Scope note"), "Restricted executive mailbox");
      setControlValue(getControlByLabel(editForm!, "Suggested repair action"), "Repair mailbox bridge health before resuming sync");
      setControlValue(getControlByLabel(editForm!, "Description"), "Inbound email context updated");
      setControlValue(getControlByLabel(editForm!, "Last synced at"), "2026-04-23T12:00:00Z");
      setControlValue(getControlByLabel(editForm!, "Last error"), "Probe degraded");
      setControlValue(getControlByLabel(editForm!, "Advanced metadata JSON"), "{\n  \"retention\": \"7d\"\n}");
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
      metadata: {
        retention: "7d",
        connector: {
          account: "mail-ops@example.com",
          collection: "Archive/Customers",
          index_mode: "headers-only",
        },
        knowledge_boundary: {
          recall_class: "operator recall",
          scope_note: "Restricted executive mailbox",
        },
        error_guidance: {
          next_step: "Repair mailbox bridge health before resuming sync",
        },
      },
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
      limit: 100,
    });
    expect(fetchMemoryDetailMock).toHaveBeenCalledWith("memory_alpha", "instance_alpha");
    expect(container.textContent).toContain("Pricing preference");
    expect(container.textContent).toContain("Delete memory");
    expect(container.textContent).toContain("Durable memory");
    expect(container.textContent).toContain("Boot candidates");
    expect(container.textContent).toContain("Working context");
    expect(container.textContent).toContain("Revoked / superseded");
    expect(container.textContent).toContain("Usage in execution runs");
    expect(container.textContent).toContain("Revision history");

    const taskLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Review outbound pricing");
    expect(taskLink?.getAttribute("href")).toBe("/tasks?instanceId=instance_alpha&taskId=task_alpha");
    const learningLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "learning_alpha");
    expect(learningLink?.getAttribute("href")).toBe("/learning?instanceId=instance_alpha&eventId=learning_alpha");
    const runLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Run run_alpha");
    expect(runLink?.getAttribute("href")).toBe("/execution?instanceId=instance_alpha&runId=run_alpha");
    const skillLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Pricing response guardrail");
    expect(skillLink?.getAttribute("href")).toBe("/skills?instanceId=instance_alpha&skillId=skill_alpha");

    const correctForm = getFormByText("Correct memory");
    const deleteForm = getFormByText("Delete memory");
    const revokeForm = getFormByText("Revoke memory");

    const correctButtonFound = getButtonByText(correctForm!, "Correct memory");

    await act(async () => {
      setControlValue(getControlByLabel(correctForm, "Title"), "Pricing preference corrected");
      setControlValue(getControlByLabel(correctForm, "Body"), "Corrected context body.");
      setControlValue(getControlByLabel(correctForm, "Correction note"), "Corrected after operator review");
      setControlValue(getControlByLabel(correctForm, "Memory layer"), "durable");
      setControlValue(getControlByLabel(correctForm, "Source trust"), "human_verified");
      setControlValue(getControlByLabel(correctForm, "Memory kind"), "preference");
      setControlValue(getControlByLabel(correctForm, "Visibility"), "restricted");
      setControlValue(getControlByLabel(correctForm, "Sensitivity"), "restricted");
      setControlValue(getControlByLabel(correctForm, "Expires at"), "2026-04-27T09:00:00Z");
      // First click shows confirmation
      correctButtonFound!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    // Click confirm to actually submit
    const confirmCorrect = getButtonByText(correctForm!, "Confirm correction");
    await act(async () => {
      confirmCorrect!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(correctMemoryEntryMock).toHaveBeenCalledWith("instance_alpha", "memory_alpha", expect.objectContaining({
      title: "Pricing preference corrected",
      body: "Corrected context body.",
      correction_note: "Corrected after operator review",
      memory_kind: "preference",
      source_trust_class: "human_verified",
      visibility_scope: "restricted",
      sensitivity: "restricted",
      expires_at: "2026-04-27T09:00:00Z",
      metadata: {
        memory_tier: "durable",
      },
    }));

    // Delete with confirmation
    await act(async () => {
      setControlValue(getControlByLabel(deleteForm, "Deletion note"), "Memory no longer valid");
      const deleteButton = getButtonByText(deleteForm!, "Delete memory");
      deleteButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const confirmDelete = getButtonByText(deleteForm!, "Confirm deletion");
    await act(async () => {
      confirmDelete!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(deleteMemoryEntryMock).toHaveBeenCalledWith("instance_alpha", "memory_alpha", {
      deletion_note: "Memory no longer valid",
    });

    // Revoke with confirmation
    await act(async () => {
      setControlValue(getControlByLabel(revokeForm, "Revocation note"), "Memory derived from invalid source");
      const revokeButton = getButtonByText(revokeForm!, "Revoke memory");
      revokeButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const confirmRevoke = getButtonByText(revokeForm!, "Confirm revocation");
    await act(async () => {
      confirmRevoke!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(revokeMemoryEntryMock).toHaveBeenCalledWith("instance_alpha", "memory_alpha", {
      revocation_note: "Memory derived from invalid source",
    });
  });
});
