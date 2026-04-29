// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchAgentsMock,
  fetchConversationsMock,
  fetchConversationDetailMock,
  fetchTasksMock,
  createConversationMock,
  createTaskMock,
  updateConversationMock,
  appendConversationMessageMock,
  fetchInboxItemsMock,
  fetchInboxItemDetailMock,
  createInboxItemMock,
  updateInboxItemMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchAgentsMock: vi.fn(),
  fetchConversationsMock: vi.fn(),
  fetchConversationDetailMock: vi.fn(),
  fetchTasksMock: vi.fn(),
  createConversationMock: vi.fn(),
  createTaskMock: vi.fn(),
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
    fetchAgents: fetchAgentsMock,
    fetchConversations: fetchConversationsMock,
    fetchConversationDetail: fetchConversationDetailMock,
    fetchTasks: fetchTasksMock,
    createConversation: createConversationMock,
    createTask: createTaskMock,
    updateConversation: updateConversationMock,
    appendConversationMessage: appendConversationMessageMock,
    fetchInboxItems: fetchInboxItemsMock,
    fetchInboxItemDetail: fetchInboxItemDetailMock,
    createInboxItem: createInboxItemMock,
    updateInboxItem: updateInboxItemMock,
  };
});

import type {
  AdminSessionUser,
  AgentSummary,
  ConversationDetail,
  ConversationSummary,
  InboxDetail,
  InboxSummary,
  TaskSummary,
} from "../src/api/admin";
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
    participant_count: 2,
    mention_count: 1,
    event_count: 1,
    participant_agent_ids: ["agent_operator", "agent_reviewer"],
    latest_message_at: "2026-04-23T10:15:00Z",
    created_at: "2026-04-23T10:00:00Z",
    updated_at: "2026-04-23T10:15:00Z",
    ...overrides,
  };
}

function createAgentSummary(overrides: Partial<AgentSummary> = {}): AgentSummary {
  return {
    agent_id: "agent_operator",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    display_name: "Operator",
    default_name: "Operator",
    role_kind: "operator",
    status: "active",
    participation_mode: "direct",
    allowed_targets: ["conversation", "task"],
    assistant_profile_id: null,
    is_default_operator: true,
    conversation_count: 1,
    mention_count: 0,
    last_activity_at: "2026-04-23T10:15:00Z",
    addressable_in_conversations: true,
    addressability_reason: "Addressable for assignment, mentions, and active conversation participation.",
    metadata: {},
    created_at: "2026-04-23T09:00:00Z",
    updated_at: "2026-04-23T10:00:00Z",
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
    participants: [
      {
        participant_id: "participant_operator",
        conversation_id: "conversation_alpha",
        thread_id: "thread_alpha",
        participant_kind: "agent",
        participant_status: "active",
        agent_id: "agent_operator",
        participant_ref: null,
        display_label: "Operator",
        metadata: {},
        created_at: "2026-04-23T10:00:00Z",
        updated_at: "2026-04-23T10:15:00Z",
      },
      {
        participant_id: "participant_reviewer",
        conversation_id: "conversation_alpha",
        thread_id: "thread_alpha",
        participant_kind: "agent",
        participant_status: "review_requested",
        agent_id: "agent_reviewer",
        participant_ref: null,
        display_label: "Reviewer",
        metadata: {},
        created_at: "2026-04-23T10:05:00Z",
        updated_at: "2026-04-23T10:15:00Z",
      },
    ],
    mentions: [
      {
        mention_id: "mention_operator",
        conversation_id: "conversation_alpha",
        thread_id: "thread_alpha",
        message_id: "message_alpha",
        agent_id: "agent_operator",
        token: "@Operator",
        agent_display_name: "Operator",
        status: "active",
        metadata: {},
        created_at: "2026-04-23T10:00:00Z",
      },
    ],
    events: [
      {
        event_id: "event_review",
        conversation_id: "conversation_alpha",
        thread_id: "thread_alpha",
        source_message_id: "message_alpha",
        event_type: "review_request_event",
        source_agent_id: null,
        target_agent_id: "agent_reviewer",
        related_object_type: "agent",
        related_object_id: "agent_reviewer",
        summary: "Review requested from Reviewer",
        metadata: {},
        created_at: "2026-04-23T10:05:00Z",
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

function createTaskSummary(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    task_id: "task_alpha",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    task_kind: "task",
    title: "Confirm pricing package",
    summary: "Confirm the final package before sending the response.",
    status: "open",
    priority: "high",
    owner_id: "agent_operator",
    conversation_id: "conversation_alpha",
    inbox_id: "inbox_alpha",
    workspace_id: "ws_alpha",
    due_at: null,
    completed_at: null,
    metadata: {},
    reminder_count: 0,
    notification_count: 0,
    created_at: "2026-04-23T10:10:00Z",
    updated_at: "2026-04-23T10:10:00Z",
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

function setMultiSelectValues(control: HTMLSelectElement, values: string[]) {
  Array.from(control.options).forEach((option) => {
    option.selected = values.includes(option.value);
  });
  control.dispatchEvent(new Event("change", { bubbles: true }));
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

function getFormByText(text: string): HTMLFormElement {
  const form = Array.from(container.querySelectorAll("form")).find((item) => item.textContent?.includes(text));
  if (!form) {
    throw new Error(`Form containing '${text}' not found.`);
  }
  return form;
}

function getButtonByText(scope: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
  if (!button) {
    throw new Error(`Button containing '${text}' not found.`);
  }
  return button as HTMLButtonElement;
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
  fetchAgentsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    agents: [
      createAgentSummary(),
      createAgentSummary({
        agent_id: "agent_reviewer",
        display_name: "Reviewer",
        default_name: "Reviewer",
        role_kind: "reviewer",
        is_default_operator: false,
      }),
      createAgentSummary({
        agent_id: "agent_mention",
        display_name: "Mention Specialist",
        default_name: "Mention Specialist",
        role_kind: "observer",
        participation_mode: "mentioned_only",
        is_default_operator: false,
        conversation_count: 0,
        mention_count: 2,
        last_activity_at: "2026-04-23T10:12:00Z",
        addressability_reason: "Addressable as a mention target only; ownership and handoff controls stay disabled.",
      }),
      createAgentSummary({
        agent_id: "agent_worker",
        display_name: "Worker",
        default_name: "Worker",
        role_kind: "worker",
        participation_mode: "handoff_only",
        is_default_operator: false,
        conversation_count: 0,
        mention_count: 0,
        last_activity_at: "2026-04-23T10:18:00Z",
        addressability_reason: "Addressable only for handoff or blocker ownership, not for mention-based routing.",
      }),
      createAgentSummary({
        agent_id: "agent_roundtable",
        display_name: "Roundtable Facilitator",
        default_name: "Roundtable Facilitator",
        role_kind: "specialist",
        participation_mode: "roundtable",
        is_default_operator: false,
        conversation_count: 1,
        mention_count: 1,
        last_activity_at: "2026-04-23T10:19:00Z",
        addressability_reason: "Addressable for mentions and broadcast/roundtable participation, but not as a dedicated owner.",
      }),
    ],
  });
  fetchConversationDetailMock.mockResolvedValue({
    status: "ok",
    conversation: createConversationDetail(),
  });
  fetchTasksMock.mockResolvedValue({
    status: "ok",
    tasks: [
      createTaskSummary(),
      createTaskSummary({
        task_id: "task_beta",
        title: "Unrelated task",
        conversation_id: "conversation_beta",
      }),
    ],
  });
  createConversationMock.mockResolvedValue({
    status: "ok",
    conversation: createConversationDetail({
      conversation_id: "conversation_beta",
      subject: "Operator follow-up",
      inbox_items: [],
      inbox_count: 0,
      participant_count: 1,
      mention_count: 1,
      event_count: 1,
      participant_agent_ids: ["agent_operator"],
    }),
  });
  createTaskMock.mockResolvedValue({
    status: "ok",
    task: createTaskSummary({
      task_id: "task_gamma",
      title: "Inbox follow-up",
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
      mention_count: 2,
      event_count: 3,
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
      mentions: [
        {
          mention_id: "mention_worker",
          conversation_id: "conversation_alpha",
          thread_id: "thread_alpha",
          message_id: "message_beta",
          agent_id: "agent_worker",
          token: "@Worker",
          agent_display_name: "Worker",
          status: "active",
          metadata: {},
          created_at: "2026-04-23T10:20:00Z",
        },
        ...createConversationDetail().mentions,
      ],
      events: [
        {
          event_id: "event_handoff",
          conversation_id: "conversation_alpha",
          thread_id: "thread_alpha",
          source_message_id: "message_beta",
          event_type: "handoff_event",
          source_agent_id: null,
          target_agent_id: "agent_worker",
          related_object_type: "agent",
          related_object_id: "agent_worker",
          summary: "Handoff requested to Worker",
          metadata: {},
          created_at: "2026-04-23T10:20:00Z",
        },
        ...createConversationDetail().events,
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
      agentId: null,
      limit: 100,
    });
    expect(fetchAgentsMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      limit: 100,
    });
    expect(fetchConversationDetailMock).toHaveBeenCalledWith("conversation_alpha", "instance_alpha");
    expect(fetchTasksMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      limit: 100,
    });
    expect(container.textContent).toContain("Conversation and thread inventory");
    expect(container.textContent).toContain("Continuation timeline");
    expect(container.textContent).toContain("Context and objects");
    expect(container.textContent).toContain("Conversation lenses");
    expect(container.textContent).toContain("Customer pricing conversation");
    expect(container.textContent).toContain("Incoming thread");
    expect(container.textContent).toContain("Agent participation");
    expect(container.textContent).toContain("Review requested from Reviewer");
    expect(container.textContent).toContain("Related tasks");
    expect(container.textContent).toContain("Confirm pricing package");
    expect(container.textContent).toContain("Structured agent routing");

    const inboxLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open inbox item");
    expect(inboxLink?.getAttribute("href")).toBe("/inbox?instanceId=instance_alpha&inboxId=inbox_alpha");
    const taskLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open task");
    expect(taskLink?.getAttribute("href")).toBe("/tasks?instanceId=instance_alpha&taskId=task_alpha");
  });

  it("applies conversation lenses and exposes structured agent composer routing", async () => {
    await renderIntoDom(withAppContext({
      path: "/conversations?instanceId=instance_alpha&conversationId=conversation_alpha",
      element: <ConversationsPage />,
      session: adminSession,
    }));
    await flushEffects();

    await act(async () => {
      setControlValue(getControlByLabel(container, "An/von Agent"), "from_agent");
    });
    await flushEffects();

    expect(container.textContent).toContain("No timeline items matched the selected thread and agent lenses.");

    const createForm = getFormByText("Create conversation");
    const appendForm = getFormByText("Append message");
    const participants = getControlByLabel(createForm, "Participants") as HTMLSelectElement;
    const initialMentions = getControlByLabel(createForm, "Initial mentions") as HTMLSelectElement;
    const mentionAgents = getControlByLabel(appendForm, "Mention agents") as HTMLSelectElement;
    const roundtableAgents = getControlByLabel(appendForm, "Roundtable agents") as HTMLSelectElement;
    const handoffTo = getControlByLabel(appendForm, "Handoff to") as HTMLSelectElement;
    const reviewRequest = getControlByLabel(appendForm, "Review request") as HTMLSelectElement;

    expect(Array.from(participants.options, (option) => option.value)).toEqual([
      "agent_operator",
      "agent_reviewer",
      "agent_roundtable",
    ]);
    expect(Array.from(initialMentions.options, (option) => option.value)).toEqual([
      "agent_operator",
      "agent_reviewer",
      "agent_mention",
      "agent_roundtable",
    ]);
    expect(Array.from(mentionAgents.options, (option) => option.value)).toEqual([
      "agent_operator",
      "agent_reviewer",
      "agent_mention",
      "agent_roundtable",
    ]);
    expect(Array.from(roundtableAgents.options, (option) => option.value)).toEqual([
      "agent_operator",
      "agent_reviewer",
      "agent_roundtable",
    ]);
    expect(Array.from(handoffTo.options, (option) => option.value)).toEqual([
      "",
      "agent_operator",
      "agent_reviewer",
      "agent_worker",
    ]);
    expect(Array.from(reviewRequest.options, (option) => option.value)).toEqual([
      "",
      "agent_operator",
      "agent_reviewer",
      "agent_worker",
    ]);

    await act(async () => {
      setMultiSelectValues(mentionAgents, ["agent_mention"]);
      setControlValue(getControlByLabel(appendForm, "Handoff to"), "agent_worker");
      setControlValue(getControlByLabel(appendForm, "Review request"), "agent_reviewer");
      setMultiSelectValues(roundtableAgents, ["agent_roundtable"]);
    });
    await flushEffects();

    expect(container.textContent).toContain("Mention Mention Specialist");
    expect(container.textContent).toContain("Handoff to Worker");
    expect(container.textContent).toContain("Review from Reviewer");
    expect(container.textContent).toContain("Roundtable Roundtable Facilitator");
  });

  it("creates, updates, and appends conversation history against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/conversations?instanceId=instance_alpha&conversationId=conversation_alpha",
      element: <ConversationsPage />,
      session: adminSession,
    }));
    await flushEffects();

    const createForm = getFormByText("Create conversation");
    const updateForm = getFormByText("Save conversation");
    const appendForm = getFormByText("Append message");
    const createButton = getButtonByText(createForm, "Create conversation");

    await act(async () => {
      setControlValue(getControlByLabel(createForm, "Subject"), "Operator follow-up");
      setControlValue(getControlByLabel(createForm, "Initial message"), "Initial operator note.");
      setControlValue(getControlByLabel(createForm, "Triage"), "relevant");
      setMultiSelectValues(getControlByLabel(createForm, "Participants") as HTMLSelectElement, ["agent_operator", "agent_roundtable"]);
      setMultiSelectValues(getControlByLabel(createForm, "Initial mentions") as HTMLSelectElement, ["agent_mention"]);
      createButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createConversationMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      subject: "Operator follow-up",
      initial_message_body: "Initial operator note.",
      triage_status: "relevant",
      participant_agent_ids: ["agent_operator", "agent_roundtable"],
      initial_mention_agent_ids: ["agent_mention"],
    }));

    const updateButton = getButtonByText(updateForm, "Save conversation");

    await act(async () => {
      setControlValue(getControlByLabel(updateForm, "Subject"), "Customer pricing conversation updated");
      updateButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateConversationMock).toHaveBeenCalledWith("instance_alpha", "conversation_alpha", expect.objectContaining({
      subject: "Customer pricing conversation updated",
    }));

    const appendButton = getButtonByText(appendForm, "Append message");

    await act(async () => {
      setControlValue(getControlByLabel(appendForm, "Continuity key"), "assistant-review-1");
      setControlValue(getControlByLabel(appendForm, "Message role"), "assistant");
      setControlValue(getControlByLabel(appendForm, "Message body"), "Assistant reviewed the thread and suggested the next handoff step.");
      setMultiSelectValues(getControlByLabel(appendForm, "Mention agents") as HTMLSelectElement, ["agent_mention"]);
      setControlValue(getControlByLabel(appendForm, "Handoff to"), "agent_worker");
      setControlValue(getControlByLabel(appendForm, "Review request"), "agent_reviewer");
      setMultiSelectValues(getControlByLabel(appendForm, "Roundtable agents") as HTMLSelectElement, ["agent_operator", "agent_roundtable"]);
      appendButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(appendConversationMessageMock).toHaveBeenCalledWith("instance_alpha", "conversation_alpha", expect.objectContaining({
      continuity_key: "assistant-review-1",
      body: "Assistant reviewed the thread and suggested the next handoff step.",
      message_role: "assistant",
      mention_agent_ids: ["agent_mention"],
      handoff_to_agent_id: "agent_worker",
      review_request_agent_id: "agent_reviewer",
      roundtable_agent_ids: ["agent_operator", "agent_roundtable"],
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
    expect(fetchAgentsMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      limit: 100,
    });
    expect(fetchTasksMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      limit: 100,
    });
    expect(fetchConversationsMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      triageStatus: "all",
      agentId: null,
      limit: 100,
    });
    expect(fetchInboxItemDetailMock).toHaveBeenCalledWith("inbox_alpha", "instance_alpha");
    expect(container.textContent).toContain("Inbox inventory");
    expect(container.textContent).toContain("Triage pricing request");
    expect(container.textContent).toContain("Conversation summary");
    expect(container.textContent).toContain("Triage actions");
    expect(container.textContent).toContain("Related tasks");
    expect(container.textContent).toContain("Queue posture new");

    const conversationLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open conversation");
    expect(conversationLink?.getAttribute("href")).toBe("/conversations?instanceId=instance_alpha&conversationId=conversation_alpha");
    const taskLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open task");
    expect(taskLink?.getAttribute("href")).toBe("/tasks?instanceId=instance_alpha&taskId=task_alpha");
  });

  it("filters inbox inventory and executes direct triage and follow-up actions for orphan items", async () => {
    const orphanItem = createInboxSummary({
      inbox_id: "inbox_orphan",
      conversation_id: null,
      thread_id: null,
      title: "Manual SLA breach intake",
      summary: "Needs owner assignment and follow-up.",
      priority: "critical",
      workspace_id: "ws_orphan",
      run_id: null,
      artifact_id: null,
      approval_id: null,
      latest_message_at: null,
    });
    fetchInboxItemsMock.mockResolvedValue({
      status: "ok",
      instance: null,
      items: [createInboxSummary(), orphanItem],
    });
    fetchInboxItemDetailMock.mockResolvedValue({
      status: "ok",
      item: createInboxDetail({
        ...orphanItem,
        conversation: null,
      }),
    });
    fetchTasksMock.mockResolvedValue({
      status: "ok",
      tasks: [
        createTaskSummary({
          task_id: "task_else",
          inbox_id: "inbox_else",
          conversation_id: "conversation_beta",
          owner_id: "agent_worker",
        }),
      ],
    });

    await renderIntoDom(withAppContext({
      path: "/inbox?instanceId=instance_alpha&inboxId=inbox_orphan",
      element: <InboxPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(container.textContent).toContain("Manual SLA breach intake");
    expect(container.textContent).toContain("Create conversation from item");
    expect(container.textContent).toContain("Create follow-up task");

    await act(async () => {
      setControlValue(getControlByLabel(container, "Source"), "manual");
    });
    await flushEffects();

    expect(container.textContent).not.toContain("Triage pricing request");

    await act(async () => {
      setControlValue(getControlByLabel(container, "Agent / owner"), "agent_operator");
    });
    await flushEffects();

    expect(container.textContent).toContain("No inbox items matched the selected filters and lenses.");

    await act(async () => {
      setControlValue(getControlByLabel(container, "Agent / owner"), "");
      getButtonByText(container, "Wait").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateInboxItemMock).toHaveBeenNthCalledWith(1, "instance_alpha", "inbox_orphan", expect.objectContaining({
      triage_status: "new",
      status: "snoozed",
    }));

    await act(async () => {
      getButtonByText(container, "Create conversation from item").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createConversationMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      subject: "Manual SLA breach intake",
      summary: "Needs owner assignment and follow-up.",
      create_inbox_entry: false,
    }));
    expect(updateInboxItemMock).toHaveBeenNthCalledWith(2, "instance_alpha", "inbox_orphan", expect.objectContaining({
      conversation_id: "conversation_beta",
      thread_id: "thread_alpha",
    }));

    await act(async () => {
      getButtonByText(container, "Create follow-up task").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createTaskMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      title: "Manual SLA breach intake",
      priority: "critical",
      inbox_id: "inbox_orphan",
      workspace_id: "ws_orphan",
    }));
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
