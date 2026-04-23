// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchConversationsMock,
  fetchConversationDetailMock,
  createConversationMock,
  updateConversationMock,
  appendConversationMessageMock,
  fetchInboxItemsMock,
  fetchInboxItemDetailMock,
  createInboxItemMock,
  updateInboxItemMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchConversationsMock: vi.fn(),
  fetchConversationDetailMock: vi.fn(),
  createConversationMock: vi.fn(),
  updateConversationMock: vi.fn(),
  appendConversationMessageMock: vi.fn(),
  fetchInboxItemsMock: vi.fn(),
  fetchInboxItemDetailMock: vi.fn(),
  createInboxItemMock: vi.fn(),
  updateInboxItemMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchConversations: fetchConversationsMock,
    fetchConversationDetail: fetchConversationDetailMock,
    createConversation: createConversationMock,
    updateConversation: updateConversationMock,
    appendConversationMessage: appendConversationMessageMock,
    fetchInboxItems: fetchInboxItemsMock,
    fetchInboxItemDetail: fetchInboxItemDetailMock,
    createInboxItem: createInboxItemMock,
    updateInboxItem: updateInboxItemMock,
  };
});

import type { AdminSessionUser, ConversationDetail, ConversationSummary, InboxDetail, InboxSummary } from "../src/api/admin";
import { ConversationsPage } from "../src/pages/ConversationsPage";
import { InboxPage } from "../src/pages/InboxPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createConversationSummary(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    conversation_id: "conversation_alpha",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    workspace_id: "ws_alpha",
    subject: "Customer pricing conversation",
    summary: "Incoming pricing question with pending runtime evidence.",
    status: "open",
    triage_status: "new",
    priority: "high",
    contact_ref: "contact://customer/acme",
    run_id: "run_alpha",
    artifact_id: "artifact_alpha",
    approval_id: "run:instance_alpha:company_alpha:approval-1",
    decision_id: "decision_preview_alpha",
    metadata: {},
    active_thread_id: "thread_alpha",
    thread_count: 1,
    session_count: 1,
    message_count: 1,
    inbox_count: 1,
    latest_message_at: "2026-04-23T10:15:00Z",
    created_at: "2026-04-23T10:00:00Z",
    updated_at: "2026-04-23T10:15:00Z",
    ...overrides,
  };
}

function createConversationDetail(overrides: Partial<ConversationDetail> = {}): ConversationDetail {
  return {
    ...createConversationSummary(),
    threads: [
      {
        thread_id: "thread_alpha",
        conversation_id: "conversation_alpha",
        title: "Incoming thread",
        status: "open",
        latest_message_at: "2026-04-23T10:15:00Z",
        message_count: 1,
        session_count: 1,
        created_at: "2026-04-23T10:00:00Z",
        updated_at: "2026-04-23T10:15:00Z",
      },
    ],
    sessions: [
      {
        session_id: "session_alpha",
        conversation_id: "conversation_alpha",
        thread_id: "thread_alpha",
        session_kind: "external",
        continuity_key: "customer-email-1",
        started_by_type: "user",
        started_by_id: "user-admin",
        message_count: 1,
        metadata: {},
        started_at: "2026-04-23T10:00:00Z",
        ended_at: null,
      },
    ],
    messages: [
      {
        message_id: "message_alpha",
        conversation_id: "conversation_alpha",
        thread_id: "thread_alpha",
        session_id: "session_alpha",
        message_role: "user",
        author_type: "user",
        author_id: "user-admin",
        body: "Can someone confirm the final pricing package?",
        structured_payload: {},
        created_at: "2026-04-23T10:00:00Z",
      },
    ],
    inbox_items: [
      {
        inbox_id: "inbox_alpha",
        instance_id: "instance_alpha",
        company_id: "company_alpha",
        conversation_id: "conversation_alpha",
        thread_id: "thread_alpha",
        workspace_id: "ws_alpha",
        title: "Triage pricing request",
        summary: "Customer needs pricing confirmation.",
        triage_status: "new",
        priority: "high",
        status: "open",
        contact_ref: "contact://customer/acme",
        run_id: "run_alpha",
        artifact_id: "artifact_alpha",
        approval_id: "run:instance_alpha:company_alpha:approval-1",
        decision_id: "decision_preview_alpha",
        metadata: {},
        latest_message_at: "2026-04-23T10:15:00Z",
        created_at: "2026-04-23T10:05:00Z",
        updated_at: "2026-04-23T10:15:00Z",
      },
    ],
    ...overrides,
  };
}

function createInboxSummary(overrides: Partial<InboxSummary> = {}): InboxSummary {
  return {
    inbox_id: "inbox_alpha",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    conversation_id: "conversation_alpha",
    thread_id: "thread_alpha",
    workspace_id: "ws_alpha",
    title: "Triage pricing request",
    summary: "Customer needs pricing confirmation.",
    triage_status: "new",
    priority: "high",
    status: "open",
    contact_ref: "contact://customer/acme",
    run_id: "run_alpha",
    artifact_id: "artifact_alpha",
    approval_id: "run:instance_alpha:company_alpha:approval-1",
    decision_id: "decision_preview_alpha",
    metadata: {},
    latest_message_at: "2026-04-23T10:15:00Z",
    created_at: "2026-04-23T10:05:00Z",
    updated_at: "2026-04-23T10:15:00Z",
    ...overrides,
  };
}

function createInboxDetail(overrides: Partial<InboxDetail> = {}): InboxDetail {
  return {
    ...createInboxSummary(),
    conversation: createConversationSummary(),
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
  fetchConversationsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    conversations: [createConversationSummary()],
  });
  fetchConversationDetailMock.mockResolvedValue({
    status: "ok",
    conversation: createConversationDetail(),
  });
  createConversationMock.mockResolvedValue({
    status: "ok",
    conversation: createConversationDetail({
      conversation_id: "conversation_beta",
      subject: "Operator follow-up",
      inbox_items: [],
      inbox_count: 0,
    }),
  });
  updateConversationMock.mockResolvedValue({
    status: "ok",
    conversation: createConversationDetail({
      subject: "Customer pricing conversation updated",
    }),
  });
  appendConversationMessageMock.mockResolvedValue({
    status: "ok",
    conversation: createConversationDetail({
      session_count: 2,
      message_count: 2,
      sessions: [
        {
          session_id: "session_beta",
          conversation_id: "conversation_alpha",
          thread_id: "thread_alpha",
          session_kind: "assistant",
          continuity_key: "assistant-review-1",
          started_by_type: "user",
          started_by_id: "user-admin",
          message_count: 1,
          metadata: {},
          started_at: "2026-04-23T10:20:00Z",
          ended_at: null,
        },
        ...createConversationDetail().sessions,
      ],
      messages: [
        {
          message_id: "message_beta",
          conversation_id: "conversation_alpha",
          thread_id: "thread_alpha",
          session_id: "session_beta",
          message_role: "assistant",
          author_type: "user",
          author_id: "user-admin",
          body: "Assistant reviewed the thread and suggested the next handoff step.",
          structured_payload: { source: "assistant_review" },
          created_at: "2026-04-23T10:20:00Z",
        },
        ...createConversationDetail().messages,
      ],
    }),
  });
  fetchInboxItemsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    items: [createInboxSummary()],
  });
  fetchInboxItemDetailMock.mockResolvedValue({
    status: "ok",
    item: createInboxDetail(),
  });
  createInboxItemMock.mockResolvedValue({
    status: "ok",
    item: createInboxDetail({
      inbox_id: "inbox_beta",
      title: "Delegate pricing follow-up",
    }),
  });
  updateInboxItemMock.mockResolvedValue({
    status: "ok",
    item: createInboxDetail({
      triage_status: "delegated",
      status: "snoozed",
      summary: "Delegated to team lead pending answer.",
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

describe("conversation and inbox pages", () => {
  it("renders the conversations page with history and linked inbox truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/conversations?instanceId=instance_alpha&conversationId=conversation_alpha",
      element: <ConversationsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchConversationsMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      triageStatus: "all",
      limit: 100,
    });
    expect(fetchConversationDetailMock).toHaveBeenCalledWith("conversation_alpha", "instance_alpha");
    expect(container.textContent).toContain("Conversation inventory");
    expect(container.textContent).toContain("Customer pricing conversation");
    expect(container.textContent).toContain("Incoming thread");

    const inboxLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open inbox item");
    expect(inboxLink?.getAttribute("href")).toBe("/inbox?instanceId=instance_alpha&inboxId=inbox_alpha");
  });

  it("creates, updates, and appends conversation history against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/conversations?instanceId=instance_alpha&conversationId=conversation_alpha",
      element: <ConversationsPage />,
      session: adminSession,
    }));
    await flushEffects();

    const forms = Array.from(container.querySelectorAll("form"));
    const createForm = forms.find((form) => form.textContent?.includes("Create conversation"));
    const updateForm = forms.find((form) => form.textContent?.includes("Save conversation"));
    const appendForm = forms.find((form) => form.textContent?.includes("Append message"));

    const createInputs = Array.from(createForm?.querySelectorAll("input") ?? []);
    const createTextareas = Array.from(createForm?.querySelectorAll("textarea") ?? []);
    const createSelects = Array.from(createForm?.querySelectorAll("select") ?? []);
    const createButton = Array.from(createForm?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("Create conversation"));

    await act(async () => {
      setControlValue(createInputs[2] as HTMLInputElement, "Operator follow-up");
      setControlValue(createTextareas[1] as HTMLTextAreaElement, "Initial operator note.");
      setControlValue(createSelects[0] as HTMLSelectElement, "relevant");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createConversationMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      subject: "Operator follow-up",
      initial_message_body: "Initial operator note.",
      triage_status: "relevant",
    }));

    const updateInputs = Array.from(updateForm?.querySelectorAll("input") ?? []);
    const updateButton = Array.from(updateForm?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("Save conversation"));

    await act(async () => {
      setControlValue(updateInputs[0] as HTMLInputElement, "Customer pricing conversation updated");
      updateButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateConversationMock).toHaveBeenCalledWith("instance_alpha", "conversation_alpha", expect.objectContaining({
      subject: "Customer pricing conversation updated",
    }));

    const appendInputs = Array.from(appendForm?.querySelectorAll("input") ?? []);
    const appendTextareas = Array.from(appendForm?.querySelectorAll("textarea") ?? []);
    const appendSelects = Array.from(appendForm?.querySelectorAll("select") ?? []);
    const appendButton = Array.from(appendForm?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("Append message"));

    await act(async () => {
      setControlValue(appendInputs[0] as HTMLInputElement, "assistant-review-1");
      setControlValue(appendTextareas[1] as HTMLTextAreaElement, "Assistant reviewed the thread and suggested the next handoff step.");
      setControlValue(appendSelects[4] as HTMLSelectElement, "assistant");
      appendButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(appendConversationMessageMock).toHaveBeenCalledWith("instance_alpha", "conversation_alpha", expect.objectContaining({
      continuity_key: "assistant-review-1",
      body: "Assistant reviewed the thread and suggested the next handoff step.",
      message_role: "assistant",
    }));
  });

  it("renders the inbox page with linked conversation truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/inbox?instanceId=instance_alpha&inboxId=inbox_alpha",
      element: <InboxPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchInboxItemsMock).toHaveBeenCalledWith("instance_alpha", {
      triageStatus: "all",
      status: "all",
      priority: "all",
      limit: 100,
    });
    expect(fetchInboxItemDetailMock).toHaveBeenCalledWith("inbox_alpha", "instance_alpha");
    expect(container.textContent).toContain("Inbox inventory");
    expect(container.textContent).toContain("Triage pricing request");
    expect(container.textContent).toContain("Conversation summary");

    const conversationLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open conversation");
    expect(conversationLink?.getAttribute("href")).toBe("/conversations?instanceId=instance_alpha&conversationId=conversation_alpha");
  });

  it("creates and updates inbox items against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/inbox?instanceId=instance_alpha&inboxId=inbox_alpha",
      element: <InboxPage />,
      session: adminSession,
    }));
    await flushEffects();

    const forms = Array.from(container.querySelectorAll("form"));
    const createForm = forms.find((form) => form.textContent?.includes("Create inbox item"));
    const updateForm = forms.find((form) => form.textContent?.includes("Save inbox item"));

    const createInputs = Array.from(createForm?.querySelectorAll("input") ?? []);
    const createSelects = Array.from(createForm?.querySelectorAll("select") ?? []);
    const createButton = Array.from(createForm?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("Create inbox item"));

    await act(async () => {
      setControlValue(createInputs[4] as HTMLInputElement, "Delegate pricing follow-up");
      setControlValue(createSelects[0] as HTMLSelectElement, "relevant");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createInboxItemMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      title: "Delegate pricing follow-up",
      triage_status: "relevant",
    }));

    const updateTextareas = Array.from(updateForm?.querySelectorAll("textarea") ?? []);
    const updateSelects = Array.from(updateForm?.querySelectorAll("select") ?? []);
    const updateButton = Array.from(updateForm?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("Save inbox item"));

    await act(async () => {
      setControlValue(updateTextareas[0] as HTMLTextAreaElement, "Delegated to team lead pending answer.");
      setControlValue(updateSelects[0] as HTMLSelectElement, "delegated");
      setControlValue(updateSelects[2] as HTMLSelectElement, "snoozed");
      updateButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateInboxItemMock).toHaveBeenCalledWith("instance_alpha", "inbox_alpha", expect.objectContaining({
      summary: "Delegated to team lead pending answer.",
      triage_status: "delegated",
      status: "snoozed",
    }));
  });
});
