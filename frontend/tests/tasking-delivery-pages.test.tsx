// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchTasksMock,
  fetchTaskDetailMock,
  createTaskMock,
  updateTaskMock,
  fetchRemindersMock,
  fetchReminderDetailMock,
  createReminderMock,
  updateReminderMock,
  fetchChannelsMock,
  fetchChannelDetailMock,
  createChannelMock,
  updateChannelMock,
  fetchNotificationsMock,
  fetchNotificationDetailMock,
  createNotificationMock,
  updateNotificationMock,
  confirmNotificationMock,
  rejectNotificationMock,
  retryNotificationMock,
  fetchAutomationsMock,
  fetchAutomationDetailMock,
  createAutomationMock,
  updateAutomationMock,
  triggerAutomationMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchTasksMock: vi.fn(),
  fetchTaskDetailMock: vi.fn(),
  createTaskMock: vi.fn(),
  updateTaskMock: vi.fn(),
  fetchRemindersMock: vi.fn(),
  fetchReminderDetailMock: vi.fn(),
  createReminderMock: vi.fn(),
  updateReminderMock: vi.fn(),
  fetchChannelsMock: vi.fn(),
  fetchChannelDetailMock: vi.fn(),
  createChannelMock: vi.fn(),
  updateChannelMock: vi.fn(),
  fetchNotificationsMock: vi.fn(),
  fetchNotificationDetailMock: vi.fn(),
  createNotificationMock: vi.fn(),
  updateNotificationMock: vi.fn(),
  confirmNotificationMock: vi.fn(),
  rejectNotificationMock: vi.fn(),
  retryNotificationMock: vi.fn(),
  fetchAutomationsMock: vi.fn(),
  fetchAutomationDetailMock: vi.fn(),
  createAutomationMock: vi.fn(),
  updateAutomationMock: vi.fn(),
  triggerAutomationMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchTasks: fetchTasksMock,
    fetchTaskDetail: fetchTaskDetailMock,
    createTask: createTaskMock,
    updateTask: updateTaskMock,
    fetchReminders: fetchRemindersMock,
    fetchReminderDetail: fetchReminderDetailMock,
    createReminder: createReminderMock,
    updateReminder: updateReminderMock,
    fetchChannels: fetchChannelsMock,
    fetchChannelDetail: fetchChannelDetailMock,
    createChannel: createChannelMock,
    updateChannel: updateChannelMock,
    fetchNotifications: fetchNotificationsMock,
    fetchNotificationDetail: fetchNotificationDetailMock,
    createNotification: createNotificationMock,
    updateNotification: updateNotificationMock,
    confirmNotification: confirmNotificationMock,
    rejectNotification: rejectNotificationMock,
    retryNotification: retryNotificationMock,
    fetchAutomations: fetchAutomationsMock,
    fetchAutomationDetail: fetchAutomationDetailMock,
    createAutomation: createAutomationMock,
    updateAutomation: updateAutomationMock,
    triggerAutomation: triggerAutomationMock,
  };
});

import type {
  AdminSessionUser,
  AutomationDetail,
  AutomationSummary,
  ChannelDetail,
  DeliveryChannelSummary,
  NotificationDetail,
  NotificationSummary,
  ReminderDetail,
  ReminderSummary,
  TaskDetail,
  TaskSummary,
} from "../src/api/admin";
import { AutomationsPage } from "../src/pages/AutomationsPage";
import { ChannelsPage } from "../src/pages/ChannelsPage";
import { NotificationsPage } from "../src/pages/NotificationsPage";
import { RemindersPage } from "../src/pages/RemindersPage";
import { TasksPage } from "../src/pages/TasksPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createTaskSummary(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    task_id: "task_alpha",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    task_kind: "follow_up",
    title: "Customer pricing follow-up",
    summary: "Review the outbound pricing reply before delivery.",
    status: "open",
    priority: "high",
    owner_id: "user-admin",
    conversation_id: "conversation_alpha",
    inbox_id: "inbox_alpha",
    workspace_id: "ws_alpha",
    due_at: "2026-04-23T12:00:00Z",
    completed_at: null,
    metadata: {},
    reminder_count: 1,
    notification_count: 1,
    created_at: "2026-04-23T09:30:00Z",
    updated_at: "2026-04-23T10:15:00Z",
    ...overrides,
  };
}

function createReminderSummary(overrides: Partial<ReminderSummary> = {}): ReminderSummary {
  return {
    reminder_id: "reminder_alpha",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    task_id: "task_alpha",
    automation_id: "automation_alpha",
    notification_id: "notification_alpha",
    title: "Price reminder",
    summary: "Follow up before the pricing reply leaves review.",
    status: "scheduled",
    due_at: "2026-04-23T11:30:00Z",
    triggered_at: null,
    metadata: {},
    created_at: "2026-04-23T09:45:00Z",
    updated_at: "2026-04-23T10:00:00Z",
    ...overrides,
  };
}

function createChannelSummary(overrides: Partial<DeliveryChannelSummary> = {}): DeliveryChannelSummary {
  return {
    channel_id: "channel_primary",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    channel_kind: "email",
    label: "Ops email",
    target: "ops@example.com",
    status: "active",
    fallback_channel_id: "channel_fallback",
    metadata: {},
    scope_label: "instance default",
    fallback_rank: 0,
    notification_count: 1,
    last_success_at: "2026-04-23T09:45:00Z",
    last_failure_at: "2026-04-23T10:05:00Z",
    last_error: "Primary channel timeout",
    created_at: "2026-04-23T09:00:00Z",
    updated_at: "2026-04-23T10:00:00Z",
    ...overrides,
  };
}

function createNotificationSummary(overrides: Partial<NotificationSummary> = {}): NotificationSummary {
  return {
    notification_id: "notification_alpha",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    task_id: "task_alpha",
    reminder_id: "reminder_alpha",
    conversation_id: "conversation_alpha",
    inbox_id: "inbox_alpha",
    workspace_id: "ws_alpha",
    channel_id: "channel_primary",
    configured_channel_id: "channel_primary",
    fallback_channel_id: "channel_fallback",
    title: "Preview customer reply",
    body: "Please confirm the outbound customer pricing response.",
    delivery_status: "preview",
    priority: "high",
    preview_required: true,
    retry_count: 1,
    max_retries: 2,
    next_attempt_at: "2026-04-23T12:15:00Z",
    last_attempt_at: "2026-04-23T10:10:00Z",
    delivered_at: null,
    rejected_at: null,
    last_error: "Primary channel timeout",
    metadata: {},
    created_at: "2026-04-23T09:50:00Z",
    updated_at: "2026-04-23T10:10:00Z",
    ...overrides,
  };
}

function createNotificationAttempt(overrides: Partial<NotificationDetail["delivery_attempts"][number]> = {}): NotificationDetail["delivery_attempts"][number] {
  return {
    attempt_id: "attempt_alpha",
    attempt_kind: "preview",
    delivery_status: "preview",
    happened_at: "2026-04-23T09:50:00Z",
    channel_id: "channel_primary",
    channel_label: "Ops email",
    channel_target: "ops@example.com",
    detail: "Created as preview-only outbox content.",
    next_step: "Confirm the preview before outward delivery.",
    ...overrides,
  };
}

function createAutomationSummary(overrides: Partial<AutomationSummary> = {}): AutomationSummary {
  return {
    automation_id: "automation_alpha",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    title: "Follow up cadence",
    summary: "Create recurring follow-up records for pricing review.",
    status: "active",
    action_kind: "create_follow_up",
    cadence_minutes: 60,
    next_run_at: "2026-04-23T13:00:00Z",
    last_run_at: "2026-04-23T12:00:00Z",
    target_task_id: "task_alpha",
    target_conversation_id: "conversation_alpha",
    target_inbox_id: "inbox_alpha",
    target_workspace_id: "ws_alpha",
    channel_id: "channel_primary",
    fallback_channel_id: "channel_fallback",
    preview_required: true,
    last_task_id: "task_alpha",
    last_reminder_id: "reminder_alpha",
    last_notification_id: "notification_alpha",
    metadata: {},
    created_at: "2026-04-23T09:00:00Z",
    updated_at: "2026-04-23T12:00:00Z",
    ...overrides,
  };
}

function createTaskDetail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    ...createTaskSummary(),
    reminders: [createReminderSummary()],
    notifications: [createNotificationSummary()],
    ...overrides,
  };
}

function createReminderDetail(overrides: Partial<ReminderDetail> = {}): ReminderDetail {
  return {
    ...createReminderSummary(),
    task: createTaskSummary(),
    notification: createNotificationSummary(),
    ...overrides,
  };
}

function createChannelDetail(overrides: Partial<ChannelDetail> = {}): ChannelDetail {
  return {
    ...createChannelSummary(),
    recent_notifications: [createNotificationSummary()],
    credential_posture: {
      storage_state: "no_secret_material",
      target_masked: false,
      redacted_fields: [],
      external_reference_fields: [],
      summary: "No secret-bearing fields are currently persisted for this channel.",
    },
    advanced_metadata: {},
    scope_reference: null,
    fallback_chain: [
      createChannelSummary(),
      createChannelSummary({
        channel_id: "channel_fallback",
        channel_kind: "slack",
        label: "Fallback Slack",
        target: "#ops-room",
        fallback_channel_id: null,
        fallback_rank: 1,
        last_error: null,
      }),
    ],
    fallback_sources: [],
    test_delivery_supported: false,
    test_delivery_state: "not_ready",
    test_delivery_reason: "Backend does not expose a dedicated channel test-send endpoint.",
    ...overrides,
  };
}

function createNotificationDetail(overrides: Partial<NotificationDetail> = {}): NotificationDetail {
  return {
    ...createNotificationSummary(),
    task: createTaskSummary(),
    reminder: createReminderSummary(),
    channel: createChannelSummary(),
    configured_channel: createChannelSummary(),
    fallback_channel: createChannelSummary({
      channel_id: "channel_fallback",
      channel_kind: "slack",
      label: "Fallback Slack",
      target: "#ops-room",
      fallback_channel_id: null,
    }),
    delivery_attempts: [createNotificationAttempt()],
    delivery_evidence: {
      effect_state: "preview_only",
      live_delivery: false,
      current_target: "ops@example.com",
      next_step: "Confirm the preview to enter the live delivery queue, or reject it before any outward send.",
      evidence_note: "No outward delivery has happened. The record is still a preview-only outbox item.",
    },
    ...overrides,
  };
}

function createAutomationDetail(overrides: Partial<AutomationDetail> = {}): AutomationDetail {
  return {
    ...createAutomationSummary(),
    task: createTaskSummary(),
    channel: createChannelSummary(),
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

function getFormByText(text: string) {
  return Array.from(container.querySelectorAll("form")).find((form) => form.textContent?.includes(text));
}

function getButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
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

  fetchTasksMock.mockResolvedValue({
    status: "ok",
    instance: null,
    tasks: [createTaskSummary()],
  });
  fetchTaskDetailMock.mockResolvedValue({
    status: "ok",
    task: createTaskDetail(),
  });
  createTaskMock.mockResolvedValue({
    status: "ok",
    task: createTaskDetail({
      task_id: "task_beta",
      title: "Escalate customer pricing",
    }),
  });
  updateTaskMock.mockResolvedValue({
    status: "ok",
    task: createTaskDetail({
      title: "Customer pricing follow-up updated",
      status: "in_progress",
    }),
  });

  fetchRemindersMock.mockResolvedValue({
    status: "ok",
    instance: null,
    reminders: [createReminderSummary()],
  });
  fetchReminderDetailMock.mockResolvedValue({
    status: "ok",
    reminder: createReminderDetail(),
  });
  createReminderMock.mockResolvedValue({
    status: "ok",
    reminder: createReminderDetail({
      reminder_id: "reminder_beta",
      title: "Escalation reminder",
    }),
  });
  updateReminderMock.mockResolvedValue({
    status: "ok",
    reminder: createReminderDetail({
      title: "Price reminder updated",
      status: "due",
    }),
  });

  fetchChannelsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    channels: [createChannelSummary()],
  });
  fetchChannelDetailMock.mockResolvedValue({
    status: "ok",
    channel: createChannelDetail(),
  });
  createChannelMock.mockResolvedValue({
    status: "ok",
    channel: createChannelDetail({
      channel_id: "channel_slack",
      channel_kind: "slack",
      label: "Ops Slack",
      target: "#ops-alerts",
    }),
  });
  updateChannelMock.mockResolvedValue({
    status: "ok",
    channel: createChannelDetail({
      label: "Ops email updated",
      target: "ops-updated@example.com",
      status: "degraded",
    }),
  });

  fetchNotificationsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    notifications: [createNotificationSummary()],
  });
  fetchNotificationDetailMock.mockResolvedValue({
    status: "ok",
    notification: createNotificationDetail(),
  });
  createNotificationMock.mockResolvedValue({
    status: "ok",
    notification: createNotificationDetail({
      notification_id: "notification_beta",
      title: "Escalate customer reply",
      delivery_status: "draft",
      delivery_attempts: [
        createNotificationAttempt({
          attempt_id: "attempt_beta",
          detail: "Created as preview-only outbox content.",
        }),
      ],
    }),
  });
  updateNotificationMock.mockResolvedValue({
    status: "ok",
    notification: createNotificationDetail({
      title: "Preview customer reply updated",
      delivery_status: "queued",
      delivery_attempts: [
        createNotificationAttempt(),
        createNotificationAttempt({
          attempt_id: "attempt_override",
          attempt_kind: "manual_override",
          delivery_status: "queued",
          happened_at: "2026-04-23T10:20:00Z",
          detail: "Operator changed delivery state from preview to queued.",
        }),
      ],
      delivery_evidence: {
        effect_state: "queued",
        live_delivery: true,
        current_target: "ops@example.com",
        next_step: "Monitor the queue and retry only if the provider or channel fails.",
        evidence_note: "The notification is positioned for live delivery. Any further outcome depends on the delivery channel.",
      },
    }),
  });
  confirmNotificationMock.mockResolvedValue({
    status: "ok",
    notification: createNotificationDetail({
      delivery_status: "queued",
      delivery_attempts: [
        createNotificationAttempt(),
        createNotificationAttempt({
          attempt_id: "attempt_confirm",
          attempt_kind: "approval",
          delivery_status: "queued",
          happened_at: "2026-04-23T10:15:00Z",
          detail: "Preview approved and moved into the live delivery queue.",
          next_step: "Wait for the live send or retry if the provider path fails.",
        }),
      ],
      delivery_evidence: {
        effect_state: "queued",
        live_delivery: true,
        current_target: "ops@example.com",
        next_step: "Monitor the queue and retry only if the provider or channel fails.",
        evidence_note: "The notification is positioned for live delivery. Any further outcome depends on the delivery channel.",
      },
    }),
  });
  rejectNotificationMock.mockResolvedValue({
    status: "ok",
    notification: createNotificationDetail({
      delivery_status: "rejected",
      rejected_at: "2026-04-23T10:16:00Z",
      delivery_attempts: [
        createNotificationAttempt(),
        createNotificationAttempt({
          attempt_id: "attempt_reject",
          attempt_kind: "approval",
          delivery_status: "rejected",
          happened_at: "2026-04-23T10:16:00Z",
          detail: "Preview rejected before live delivery continued.",
          next_step: "Edit the notification content or routing, then confirm it again when it is ready.",
        }),
      ],
      delivery_evidence: {
        effect_state: "rejected",
        live_delivery: false,
        current_target: "ops@example.com",
        next_step: "Edit the message or routing, then confirm it again when the preview is acceptable.",
        evidence_note: "The notification was blocked before live delivery resumed.",
      },
    }),
  });
  retryNotificationMock.mockResolvedValue({
    status: "ok",
    notification: createNotificationDetail({
      delivery_status: "fallback_queued",
      retry_count: 2,
      channel_id: "channel_fallback",
      channel: createChannelSummary({
        channel_id: "channel_fallback",
        channel_kind: "slack",
        label: "Fallback Slack",
        target: "#ops-room",
        fallback_channel_id: null,
      }),
      configured_channel_id: "channel_primary",
      configured_channel: createChannelSummary(),
      delivery_attempts: [
        createNotificationAttempt(),
        createNotificationAttempt({
          attempt_id: "attempt_retry",
          attempt_kind: "fallback",
          delivery_status: "fallback_queued",
          happened_at: "2026-04-23T10:18:00Z",
          channel_id: "channel_fallback",
          channel_label: "Fallback Slack",
          channel_target: "#ops-room",
          detail: "Primary delivery exhausted its retry budget and moved to the fallback channel.",
          next_step: "Monitor the fallback channel and inspect its health before forcing another retry.",
        }),
      ],
      delivery_evidence: {
        effect_state: "queued",
        live_delivery: true,
        current_target: "#ops-room",
        next_step: "Monitor the queue and retry only if the provider or channel fails.",
        evidence_note: "The notification is positioned for live delivery. Any further outcome depends on the delivery channel.",
      },
    }),
  });

  fetchAutomationsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    automations: [createAutomationSummary()],
  });
  fetchAutomationDetailMock.mockResolvedValue({
    status: "ok",
    automation: createAutomationDetail(),
  });
  createAutomationMock.mockResolvedValue({
    status: "ok",
    automation: createAutomationDetail({
      automation_id: "automation_beta",
      title: "Escalation automation",
      action_kind: "create_notification",
    }),
  });
  updateAutomationMock.mockResolvedValue({
    status: "ok",
    automation: createAutomationDetail({
      title: "Follow up cadence updated",
      status: "paused",
      cadence_minutes: 120,
    }),
  });
  triggerAutomationMock.mockResolvedValue({
    status: "ok",
    automation: createAutomationDetail({
      last_run_at: "2026-04-23T12:30:00Z",
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

describe("tasking and delivery pages", () => {
  it("renders the tasks page with linked reminder and notification truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/tasks?instanceId=instance_alpha&taskId=task_alpha",
      element: <TasksPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchTasksMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      limit: 100,
    });
    expect(fetchTaskDetailMock).toHaveBeenCalledWith("task_alpha", "instance_alpha");
    expect(container.textContent).toContain("Task inventory");
    expect(container.textContent).toContain("Customer pricing follow-up");
    expect(container.textContent).toContain("Reminders");
    expect(container.textContent).toContain("Status actions");
    expect(container.textContent).toContain("Reminder path");
    expect(container.textContent).toContain("bridge-only");

    const reminderLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Price reminder");
    expect(reminderLink?.getAttribute("href")).toBe("/reminders?instanceId=instance_alpha&reminderId=reminder_alpha");
  });

  it("runs direct task status and reminder actions from the task detail surface", async () => {
    fetchTaskDetailMock.mockResolvedValue({
      status: "ok",
      task: createTaskDetail({
        reminders: [],
        notifications: [],
      }),
    });

    await renderIntoDom(withAppContext({
      path: "/tasks?instanceId=instance_alpha&taskId=task_alpha",
      element: <TasksPage />,
      session: adminSession,
    }));
    await flushEffects();

    await act(async () => {
      getButtonByText(container, "Start work")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateTaskMock).toHaveBeenNthCalledWith(1, "instance_alpha", "task_alpha", expect.objectContaining({
      status: "in_progress",
      completed_at: null,
    }));

    await act(async () => {
      getButtonByText(container, "Create reminder from task")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createReminderMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      task_id: "task_alpha",
      title: "Customer pricing follow-up reminder",
      due_at: "2026-04-23T12:00:00Z",
    }));
  });

  it("creates and updates tasks from the drawer against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/tasks?instanceId=instance_alpha&taskId=task_alpha",
      element: <TasksPage />,
      session: adminSession,
    }));
    await flushEffects();

    await act(async () => {
      getButtonByText(container, "New task")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const createForm = container.querySelector("#task-drawer-form") as HTMLFormElement;

    await act(async () => {
      setControlValue(getControlByLabel(createForm, "Task ID"), "task_beta");
      setControlValue(getControlByLabel(createForm, "Task kind"), "follow_up");
      setControlValue(getControlByLabel(createForm, "Title"), "Escalate customer pricing");
      setControlValue(getControlByLabel(createForm, "Summary"), "Escalate the pricing review today.");
      setControlValue(getControlByLabel(createForm, "Status"), "blocked");
      setControlValue(getControlByLabel(createForm, "Priority"), "critical");
      setControlValue(getControlByLabel(createForm, "Owner ID"), "user-lead");
      setControlValue(getControlByLabel(createForm, "Conversation ID"), "conversation_beta");
      getButtonByText(container, "Create task")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createTaskMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      task_id: "task_beta",
      task_kind: "follow_up",
      title: "Escalate customer pricing",
      summary: "Escalate the pricing review today.",
      status: "blocked",
      priority: "critical",
      owner_id: "user-lead",
      conversation_id: "conversation_beta",
    }));

    await act(async () => {
      getButtonByText(container, "Edit selected task")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const updateForm = container.querySelector("#task-drawer-form") as HTMLFormElement;

    await act(async () => {
      setControlValue(getControlByLabel(updateForm, "Title"), "Customer pricing follow-up updated");
      setControlValue(getControlByLabel(updateForm, "Summary"), "Review package was updated and reassigned.");
      setControlValue(getControlByLabel(updateForm, "Status"), "in_progress");
      setControlValue(getControlByLabel(updateForm, "Priority"), "normal");
      setControlValue(getControlByLabel(updateForm, "Conversation ID"), "conversation_beta");
      getButtonByText(container, "Save task changes")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateTaskMock).toHaveBeenCalledWith("instance_alpha", "task_alpha", expect.objectContaining({
      title: "Customer pricing follow-up updated",
      summary: "Review package was updated and reassigned.",
      status: "in_progress",
      priority: "normal",
      conversation_id: "conversation_beta",
    }));
  });

  it("renders the reminders page with linked task and notification truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/reminders?instanceId=instance_alpha&reminderId=reminder_alpha",
      element: <RemindersPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchRemindersMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      limit: 100,
    });
    expect(fetchReminderDetailMock).toHaveBeenCalledWith("reminder_alpha", "instance_alpha");
    expect(container.textContent).toContain("Reminder inventory");
    expect(container.textContent).toContain("Price reminder");
    expect(container.textContent).toContain("Task linkage");
    expect(container.textContent).toContain("Origin");
    expect(container.textContent).toContain("Reminder actions");

    const taskLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open task");
    expect(taskLink?.getAttribute("href")).toBe("/tasks?instanceId=instance_alpha&taskId=task_alpha");
    const automationLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open automation");
    expect(automationLink?.getAttribute("href")).toBe("/automations?instanceId=instance_alpha&automationId=automation_alpha");
  });

  it("groups reminders by urgency and runs direct reminder actions from the detail surface", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00Z"));

    fetchRemindersMock.mockResolvedValue({
      status: "ok",
      instance: null,
      reminders: [
        createReminderSummary({
          reminder_id: "reminder_overdue",
          title: "Overdue reminder",
          due_at: "2026-04-23T10:30:00Z",
          status: "scheduled",
        }),
        createReminderSummary({
          reminder_id: "reminder_due",
          title: "Due reminder",
          due_at: "2026-04-23T12:15:00Z",
          status: "due",
        }),
        createReminderSummary({
          reminder_id: "reminder_upcoming",
          title: "Upcoming reminder",
          due_at: "2026-04-23T14:30:00Z",
          status: "scheduled",
        }),
        createReminderSummary({
          reminder_id: "reminder_closed",
          title: "Closed reminder",
          due_at: "2026-04-23T09:00:00Z",
          status: "dismissed",
        }),
      ],
    });
    fetchReminderDetailMock.mockResolvedValue({
      status: "ok",
      reminder: createReminderDetail({
        reminder_id: "reminder_due",
        title: "Due reminder",
        due_at: "2026-04-23T12:15:00Z",
        status: "due",
      }),
    });

    try {
      await renderIntoDom(withAppContext({
        path: "/reminders?instanceId=instance_alpha&reminderId=reminder_due",
        element: <RemindersPage />,
        session: adminSession,
      }));
      await flushEffects();

      expect(container.textContent).toContain("Overdue");
      expect(container.textContent).toContain("Due now");
      expect(container.textContent).toContain("Upcoming");
      expect(container.textContent).toContain("Completed / cancelled");

      await act(async () => {
        getButtonByText(container, "Snooze 1 day")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await flushEffects();

      expect(updateReminderMock).toHaveBeenNthCalledWith(1, "instance_alpha", "reminder_due", expect.objectContaining({
        status: "scheduled",
        due_at: "2026-04-24T12:15:00.000Z",
        triggered_at: null,
      }));

      await act(async () => {
        getButtonByText(container, "Complete reminder")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await flushEffects();

      expect(updateReminderMock).toHaveBeenNthCalledWith(2, "instance_alpha", "reminder_due", expect.objectContaining({
        status: "dismissed",
      }));

      await act(async () => {
        getButtonByText(container, "Cancel reminder")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await flushEffects();

      expect(updateReminderMock).toHaveBeenNthCalledWith(3, "instance_alpha", "reminder_due", expect.objectContaining({
        status: "cancelled",
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("creates and updates reminders from the drawer against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/reminders?instanceId=instance_alpha&reminderId=reminder_alpha",
      element: <RemindersPage />,
      session: adminSession,
    }));
    await flushEffects();

    await act(async () => {
      getButtonByText(container, "New reminder")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const createForm = container.querySelector("#reminder-drawer-form") as HTMLFormElement;

    await act(async () => {
      setControlValue(getControlByLabel(createForm, "Reminder ID"), "reminder_beta");
      setControlValue(getControlByLabel(createForm, "Task ID"), "task_beta");
      setControlValue(getControlByLabel(createForm, "Title"), "Escalation reminder");
      setControlValue(getControlByLabel(createForm, "Summary"), "Escalate the follow-up if no response lands.");
      setControlValue(getControlByLabel(createForm, "Due at"), "2026-04-23T13:30:00Z");
      getButtonByText(container, "Create reminder")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createReminderMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      reminder_id: "reminder_beta",
      task_id: "task_beta",
      title: "Escalation reminder",
      summary: "Escalate the follow-up if no response lands.",
      due_at: "2026-04-23T13:30:00Z",
    }));

    await act(async () => {
      getButtonByText(container, "Edit selected reminder")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const updateForm = container.querySelector("#reminder-drawer-form") as HTMLFormElement;

    await act(async () => {
      setControlValue(getControlByLabel(updateForm, "Task ID"), "task_beta");
      setControlValue(getControlByLabel(updateForm, "Notification ID"), "notification_beta");
      setControlValue(getControlByLabel(updateForm, "Title"), "Price reminder updated");
      setControlValue(getControlByLabel(updateForm, "Summary"), "Reminder updated after operator review.");
      setControlValue(getControlByLabel(updateForm, "Status"), "due");
      setControlValue(getControlByLabel(updateForm, "Due at"), "2026-04-23T14:00:00Z");
      setControlValue(getControlByLabel(updateForm, "Triggered at"), "2026-04-23T13:45:00Z");
      getButtonByText(container, "Save reminder changes")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateReminderMock).toHaveBeenCalledWith("instance_alpha", "reminder_alpha", expect.objectContaining({
      task_id: "task_beta",
      notification_id: "notification_beta",
      title: "Price reminder updated",
      summary: "Reminder updated after operator review.",
      status: "due",
      due_at: "2026-04-23T14:00:00Z",
      triggered_at: "2026-04-23T13:45:00Z",
    }));
  });

  it("renders the channels page with fallback and recent notification truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/channels?instanceId=instance_alpha&channelId=channel_primary",
      element: <ChannelsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchChannelsMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      kind: "all",
      limit: 100,
    });
    expect(fetchChannelDetailMock).toHaveBeenCalledWith("channel_primary", "instance_alpha");
    expect(container.textContent).toContain("Channel inventory");
    expect(container.textContent).toContain("Ops email");
    expect(container.textContent).toContain("Credential / secret posture");
    expect(container.textContent).toContain("Fallback chain");
    expect(container.textContent).toContain("Recent notifications");
    expect(container.textContent).toContain("Test send");
    expect(container.textContent).toContain("not_ready");

    const fallbackLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open fallback channel");
    expect(fallbackLink).toBeUndefined();
    expect(Array.from(container.querySelectorAll("a")).some((link) => link.getAttribute("href") === "/channels?instanceId=instance_alpha&channelId=channel_fallback")).toBe(true);
  });

  it("creates and updates channels against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/channels?instanceId=instance_alpha&channelId=channel_primary",
      element: <ChannelsPage />,
      session: adminSession,
    }));
    await flushEffects();

    const createForm = getFormByText("Create channel");
    const updateForm = getFormByText("Save channel");
    const createButton = getButtonByText(createForm!, "Create channel");

    await act(async () => {
      setControlValue(getControlByLabel(createForm!, "Channel ID"), "channel_slack");
      setControlValue(getControlByLabel(createForm!, "Channel kind"), "slack");
      setControlValue(getControlByLabel(createForm!, "Status"), "degraded");
      setControlValue(getControlByLabel(createForm!, "Label"), "Ops Slack");
      setControlValue(getControlByLabel(createForm!, "Target"), "#ops-alerts");
      setControlValue(getControlByLabel(createForm!, "Fallback channel ID"), "channel_fallback");
      setControlValue(getControlByLabel(createForm!, "Metadata JSON"), "{\"tier\":\"secondary\"}");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createChannelMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      channel_id: "channel_slack",
      channel_kind: "slack",
      label: "Ops Slack",
      target: "#ops-alerts",
      status: "degraded",
      fallback_channel_id: "channel_fallback",
      metadata: { tier: "secondary" },
    }));

    const updateButton = getButtonByText(updateForm!, "Save channel");

    await act(async () => {
      setControlValue(getControlByLabel(updateForm!, "Label"), "Ops email updated");
      setControlValue(getControlByLabel(updateForm!, "Status"), "degraded");
      setControlValue(getControlByLabel(updateForm!, "Fallback channel ID"), "channel_fallback");
      setControlValue(getControlByLabel(updateForm!, "Target"), "ops-updated@example.com");
      setControlValue(getControlByLabel(updateForm!, "Metadata JSON"), "{\"tier\":\"primary\"}");
      updateButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateChannelMock).toHaveBeenCalledWith("instance_alpha", "channel_primary", expect.objectContaining({
      label: "Ops email updated",
      target: "ops-updated@example.com",
      status: "degraded",
      fallback_channel_id: "channel_fallback",
      metadata: { tier: "primary" },
    }));
  });

  it("filters channels by type/status and keeps webhook credential posture redacted without fake test-send actions", async () => {
    fetchChannelsMock.mockImplementation(async (_instanceId: string, filters?: { status?: string; kind?: string }) => ({
      status: "ok",
      instance: null,
      channels: filters?.kind === "webhook"
        ? [
          createChannelSummary({
            channel_id: "channel_webhook",
            channel_kind: "webhook",
            label: "Ops webhook",
            target: "https://hooks.example.com/[redacted]",
            status: "degraded",
            fallback_channel_id: null,
            scope_label: "contact-bound",
            last_error: "HTTP 410 Gone",
            last_success_at: null,
          }),
        ]
        : [createChannelSummary()],
    }));
    fetchChannelDetailMock.mockResolvedValue({
      status: "ok",
      channel: createChannelDetail({
        channel_id: "channel_webhook",
        channel_kind: "webhook",
        label: "Ops webhook",
        target: "https://hooks.example.com/[redacted]",
        status: "degraded",
        fallback_channel_id: null,
        metadata: {
          contact_ref: "contact://customer/acme",
          credential_ref: "vault://channels/ops-webhook",
          api_key: "[redacted]",
        },
        scope_label: "contact-bound",
        fallback_rank: 0,
        notification_count: 2,
        last_success_at: null,
        last_failure_at: "2026-04-23T10:20:00Z",
        last_error: "HTTP 410 Gone",
        credential_posture: {
          storage_state: "inline_secret_redacted",
          target_masked: true,
          redacted_fields: ["api_key"],
          external_reference_fields: ["credential_ref"],
          summary: "Secret-bearing metadata was detected and redacted. Move credentials behind references or a delivery bridge.",
        },
        advanced_metadata: {
          contact_ref: "contact://customer/acme",
          credential_ref: "vault://channels/ops-webhook",
          api_key: "[redacted]",
        },
        scope_reference: "contact://customer/acme",
        fallback_chain: [
          createChannelSummary({
            channel_id: "channel_webhook",
            channel_kind: "webhook",
            label: "Ops webhook",
            target: "https://hooks.example.com/[redacted]",
            status: "degraded",
            fallback_channel_id: null,
            scope_label: "contact-bound",
            last_success_at: null,
            last_error: "HTTP 410 Gone",
          }),
        ],
        fallback_sources: [
          createChannelSummary({
            channel_id: "channel_primary",
            channel_kind: "email",
            label: "Ops email",
            target: "ops@example.com",
          }),
        ],
        recent_notifications: [
          createNotificationSummary({
            notification_id: "notification_webhook",
            channel_id: "channel_webhook",
            configured_channel_id: "channel_webhook",
            fallback_channel_id: null,
            delivery_status: "failed",
            last_error: "HTTP 410 Gone",
          }),
        ],
      }),
    });

    await renderIntoDom(withAppContext({
      path: "/channels?instanceId=instance_alpha&channelId=channel_webhook",
      element: <ChannelsPage />,
      session: adminSession,
    }));
    await flushEffects();

    await act(async () => {
      setControlValue(container.querySelector('select[aria-label="Channel kind filter"]') as HTMLSelectElement, "webhook");
    });
    await flushEffects();

    await act(async () => {
      setControlValue(container.querySelector('select[aria-label="Channel status filter"]') as HTMLSelectElement, "degraded");
    });
    await flushEffects();

    expect(fetchChannelsMock).toHaveBeenLastCalledWith("instance_alpha", {
      status: "degraded",
      kind: "webhook",
      limit: 100,
    });
    expect(container.textContent).toContain("inline_secret_redacted");
    expect(container.textContent).toContain("api_key");
    expect(container.textContent).toContain("vault://channels/ops-webhook");
    expect(container.textContent).toContain("contact://customer/acme");
    expect(container.textContent).toContain("not_ready");
    expect(container.textContent).not.toContain("secret-123");
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent?.includes("Send test"))).toBe(false);
  });

  it("renders the notifications page with grouped outbox, fallback chain, and delivery evidence", async () => {
    await renderIntoDom(withAppContext({
      path: "/notifications?instanceId=instance_alpha&notificationId=notification_alpha",
      element: <NotificationsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchNotificationsMock).toHaveBeenCalledWith("instance_alpha", {
      deliveryStatus: "all",
      priority: "all",
      limit: 100,
    });
    expect(fetchNotificationDetailMock).toHaveBeenCalledWith("notification_alpha", "instance_alpha");
    expect(container.textContent).toContain("Outbox table");
    expect(container.textContent).toContain("Pending approval / preview");
    expect(container.textContent).toContain("Preview customer reply");
    expect(container.textContent).toContain("Target and fallback chain");
    expect(container.textContent).toContain("Delivery attempts");
    expect(container.textContent).toContain("Fallback Slack");

    const channelLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open configured channel");
    expect(channelLink?.getAttribute("href")).toBe("/channels?instanceId=instance_alpha&channelId=channel_primary");
  });

  it("creates, updates, confirms, rejects, and retries notifications against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/notifications?instanceId=instance_alpha&notificationId=notification_alpha",
      element: <NotificationsPage />,
      session: adminSession,
    }));
    await flushEffects();

    await act(async () => {
      getButtonByText(container, "New notification")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const createForm = container.querySelector("#notifications-drawer-form") as HTMLFormElement;

    await act(async () => {
      setControlValue(getControlByLabel(createForm, "Notification ID"), "notification_beta");
      setControlValue(getControlByLabel(createForm, "Task ID"), "task_beta");
      setControlValue(getControlByLabel(createForm, "Reminder ID"), "reminder_beta");
      setControlValue(getControlByLabel(createForm, "Conversation ID"), "conversation_beta");
      setControlValue(getControlByLabel(createForm, "Inbox ID"), "inbox_beta");
      setControlValue(getControlByLabel(createForm, "Workspace ID"), "ws_beta");
      setControlValue(getControlByLabel(createForm, "Channel ID"), "channel_primary");
      setControlValue(getControlByLabel(createForm, "Fallback channel ID"), "channel_fallback");
      setControlValue(getControlByLabel(createForm, "Preview required"), "no");
      setControlValue(getControlByLabel(createForm, "Priority"), "critical");
      setControlValue(getControlByLabel(createForm, "Max retries"), "3");
      setControlValue(getControlByLabel(createForm, "Title"), "Escalate customer reply");
      setControlValue(getControlByLabel(createForm, "Body"), "Escalate the outbound customer response.");
      setControlValue(getControlByLabel(createForm, "Metadata JSON"), "{\"channel\":\"primary\"}");
      getButtonByText(container, "Create notification")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createNotificationMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      notification_id: "notification_beta",
      task_id: "task_beta",
      reminder_id: "reminder_beta",
      conversation_id: "conversation_beta",
      inbox_id: "inbox_beta",
      workspace_id: "ws_beta",
      channel_id: "channel_primary",
      fallback_channel_id: "channel_fallback",
      title: "Escalate customer reply",
      body: "Escalate the outbound customer response.",
      priority: "critical",
      preview_required: false,
      max_retries: 3,
      metadata: { channel: "primary" },
    }));

    await act(async () => {
      getButtonByText(container, "Edit selected notification")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const updateForm = container.querySelector("#notifications-drawer-form") as HTMLFormElement;

    await act(async () => {
      setControlValue(getControlByLabel(updateForm, "Channel ID"), "channel_primary");
      setControlValue(getControlByLabel(updateForm, "Fallback channel ID"), "channel_fallback");
      setControlValue(getControlByLabel(updateForm, "Preview required"), "no");
      setControlValue(getControlByLabel(updateForm, "Priority"), "normal");
      setControlValue(getControlByLabel(updateForm, "Max retries"), "4");
      setControlValue(getControlByLabel(updateForm, "Delivery status"), "queued");
      setControlValue(getControlByLabel(updateForm, "Title"), "Preview customer reply updated");
      setControlValue(getControlByLabel(updateForm, "Body"), "Updated outbound customer response preview.");
      setControlValue(getControlByLabel(updateForm, "Last error"), "Transient provider error");
      setControlValue(getControlByLabel(updateForm, "Metadata JSON"), "{\"channel\":\"fallback\"}");
      getButtonByText(container, "Save notification")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateNotificationMock).toHaveBeenCalledWith("instance_alpha", "notification_alpha", expect.objectContaining({
      channel_id: "channel_primary",
      fallback_channel_id: "channel_fallback",
      title: "Preview customer reply updated",
      body: "Updated outbound customer response preview.",
      delivery_status: "queued",
      priority: "normal",
      preview_required: false,
      max_retries: 4,
      last_error: "Transient provider error",
      metadata: { channel: "fallback" },
    }));

    const confirmButton = getButtonByText(container, "Approve preview");
    const rejectButton = getButtonByText(container, "Reject preview");
    const retryButton = getButtonByText(container, "Retry delivery");

    await act(async () => {
      confirmButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();
    await act(async () => {
      rejectButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();
    await act(async () => {
      retryButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(confirmNotificationMock).toHaveBeenCalledWith("instance_alpha", "notification_alpha");
    expect(rejectNotificationMock).toHaveBeenCalledWith("instance_alpha", "notification_alpha");
    expect(retryNotificationMock).toHaveBeenCalledWith("instance_alpha", "notification_alpha");
    expect(container.textContent).toContain("Latest queue mutation");
    expect(container.textContent).toContain("fallback_queued");
    expect(container.textContent).toContain("Configured primary channel: Ops email (channel_primary)");
    expect(container.textContent).toContain("Active delivery channel: Fallback Slack (channel_fallback)");

    const activeChannelLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open active delivery channel");
    const fallbackChannelLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open fallback channel");
    expect(activeChannelLink?.getAttribute("href")).toBe("/channels?instanceId=instance_alpha&channelId=channel_fallback");
    expect(fallbackChannelLink?.getAttribute("href")).toBe("/channels?instanceId=instance_alpha&channelId=channel_fallback");
  });

  it("renders the automations page with target and last-trigger truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/automations?instanceId=instance_alpha&automationId=automation_alpha",
      element: <AutomationsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchAutomationsMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      limit: 100,
    });
    expect(fetchAutomationDetailMock).toHaveBeenCalledWith("automation_alpha", "instance_alpha");
    expect(container.textContent).toContain("Automation inventory");
    expect(container.textContent).toContain("Follow up cadence");
    expect(container.textContent).toContain("Trigger history");
    expect(container.textContent).toContain("Governance");
    expect(container.textContent).toContain("preview gating");
    expect(container.textContent).not.toContain("Advanced raw cadence minutes");
    expect(container.textContent).not.toContain("Metadata JSON");

    const lastNotificationLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open last notification");
    expect(lastNotificationLink?.getAttribute("href")).toBe("/notifications?instanceId=instance_alpha&notificationId=notification_alpha");
  });

  it("creates, updates, and triggers automations against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/automations?instanceId=instance_alpha&automationId=automation_alpha",
      element: <AutomationsPage />,
      session: adminSession,
    }));
    await flushEffects();

    const createForm = getFormByText("Create automation");
    const updateForm = getFormByText("Save automation");
    const createButton = getButtonByText(createForm!, "Create automation");

    await act(async () => {
      setControlValue(getControlByLabel(createForm!, "Automation ID"), "automation_beta");
      setControlValue(getControlByLabel(createForm!, "Action kind"), "create_notification");
      setControlValue(getControlByLabel(createForm!, "Title"), "Escalation automation");
      setControlValue(getControlByLabel(createForm!, "Summary"), "Generate escalation notifications on a cadence.");
      setControlValue(getControlByLabel(createForm!, "Every"), "90");
      setControlValue(getControlByLabel(createForm!, "Unit"), "minutes");
      setControlValue(getControlByLabel(createForm!, "Next run at"), "2026-04-23T15:00:00Z");
      setControlValue(getControlByLabel(createForm!, "Target task ID"), "task_beta");
      setControlValue(getControlByLabel(createForm!, "Channel ID"), "channel_primary");
      setControlValue(getControlByLabel(createForm!, "Fallback channel ID"), "channel_fallback");
      setControlValue(getControlByLabel(createForm!, "Preview required"), "no");
      setControlValue(getControlByLabel(createForm!, "Task template title"), "Escalation task");
      setControlValue(getControlByLabel(createForm!, "Notification title"), "Escalation notification");
      setControlValue(getControlByLabel(createForm!, "Task template summary"), "Create the escalation task with the latest context.");
      setControlValue(getControlByLabel(createForm!, "Notification body"), "Escalate this work item immediately.");
      getButtonByText(createForm!, "Show advanced fields")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    await act(async () => {
      setControlValue(getControlByLabel(createForm!, "Metadata JSON"), "{\"cadence\":\"tight\"}");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createAutomationMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      automation_id: "automation_beta",
      action_kind: "create_notification",
      title: "Escalation automation",
      summary: "Generate escalation notifications on a cadence.",
      cadence_minutes: 90,
      next_run_at: "2026-04-23T15:00:00Z",
      target_task_id: "task_beta",
      channel_id: "channel_primary",
      fallback_channel_id: "channel_fallback",
      preview_required: false,
      task_template_title: "Escalation task",
      task_template_summary: "Create the escalation task with the latest context.",
      notification_title: "Escalation notification",
      notification_body: "Escalate this work item immediately.",
      metadata: { cadence: "tight" },
    }));

    const updateButton = getButtonByText(updateForm!, "Save automation");

    await act(async () => {
      setControlValue(getControlByLabel(updateForm!, "Title"), "Follow up cadence updated");
      setControlValue(getControlByLabel(updateForm!, "Summary"), "Recurring rule updated after audit.");
      setControlValue(getControlByLabel(updateForm!, "Status"), "paused");
      setControlValue(getControlByLabel(updateForm!, "Every"), "2");
      setControlValue(getControlByLabel(updateForm!, "Unit"), "hours");
      setControlValue(getControlByLabel(updateForm!, "Next run at"), "2026-04-23T16:00:00Z");
      setControlValue(getControlByLabel(updateForm!, "Target workspace ID"), "ws_beta");
      setControlValue(getControlByLabel(updateForm!, "Channel ID"), "channel_fallback");
      setControlValue(getControlByLabel(updateForm!, "Preview required"), "no");
      getButtonByText(updateForm!, "Show advanced fields")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    await act(async () => {
      setControlValue(getControlByLabel(updateForm!, "Metadata JSON"), "{\"cadence\":\"paused\"}");
      updateButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateAutomationMock).toHaveBeenCalledWith("instance_alpha", "automation_alpha", expect.objectContaining({
      title: "Follow up cadence updated",
      summary: "Recurring rule updated after audit.",
      status: "paused",
      cadence_minutes: 120,
      next_run_at: "2026-04-23T16:00:00Z",
      target_workspace_id: "ws_beta",
      channel_id: "channel_fallback",
      preview_required: false,
      metadata: { cadence: "paused" },
    }));

    const triggerButton = getButtonByText(container, "Test now");
    await act(async () => {
      triggerButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(triggerAutomationMock).toHaveBeenCalledWith("instance_alpha", "automation_alpha");
    expect(container.textContent).toContain("Latest test trigger");
    expect(container.textContent).toContain("2026-04-23T12:30:00Z");
  });
});
