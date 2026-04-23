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
    notification_count: 1,
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
    ...overrides,
  };
}

function createNotificationDetail(overrides: Partial<NotificationDetail> = {}): NotificationDetail {
  return {
    ...createNotificationSummary(),
    task: createTaskSummary(),
    reminder: createReminderSummary(),
    channel: createChannelSummary(),
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
    }),
  });
  updateNotificationMock.mockResolvedValue({
    status: "ok",
    notification: createNotificationDetail({
      title: "Preview customer reply updated",
      delivery_status: "queued",
    }),
  });
  confirmNotificationMock.mockResolvedValue({
    status: "ok",
    notification: createNotificationDetail({
      delivery_status: "confirmed",
    }),
  });
  rejectNotificationMock.mockResolvedValue({
    status: "ok",
    notification: createNotificationDetail({
      delivery_status: "rejected",
    }),
  });
  retryNotificationMock.mockResolvedValue({
    status: "ok",
    notification: createNotificationDetail({
      delivery_status: "fallback_queued",
      retry_count: 2,
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

    const reminderLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Price reminder");
    expect(reminderLink?.getAttribute("href")).toBe("/reminders?instanceId=instance_alpha&reminderId=reminder_alpha");
  });

  it("creates and updates tasks against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/tasks?instanceId=instance_alpha&taskId=task_alpha",
      element: <TasksPage />,
      session: adminSession,
    }));
    await flushEffects();

    const createForm = getFormByText("Create task");
    const updateForm = getFormByText("Save task");
    const createInputs = Array.from(createForm?.querySelectorAll("input") ?? []);
    const createTextareas = Array.from(createForm?.querySelectorAll("textarea") ?? []);
    const createSelects = Array.from(createForm?.querySelectorAll("select") ?? []);
    const createButton = getButtonByText(createForm!, "Create task");

    await act(async () => {
      setControlValue(createInputs[0] as HTMLInputElement, "task_beta");
      setControlValue(createSelects[0] as HTMLSelectElement, "follow_up");
      setControlValue(createSelects[1] as HTMLSelectElement, "critical");
      setControlValue(createInputs[1] as HTMLInputElement, "Escalate customer pricing");
      setControlValue(createTextareas[0] as HTMLTextAreaElement, "Escalate the pricing review today.");
      setControlValue(createSelects[2] as HTMLSelectElement, "blocked");
      setControlValue(createInputs[2] as HTMLInputElement, "user-lead");
      setControlValue(createInputs[4] as HTMLInputElement, "conversation_beta");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

    const updateInputs = Array.from(updateForm?.querySelectorAll("input") ?? []);
    const updateTextareas = Array.from(updateForm?.querySelectorAll("textarea") ?? []);
    const updateSelects = Array.from(updateForm?.querySelectorAll("select") ?? []);
    const updateButton = getButtonByText(updateForm!, "Save task");

    await act(async () => {
      setControlValue(updateInputs[0] as HTMLInputElement, "Customer pricing follow-up updated");
      setControlValue(updateTextareas[0] as HTMLTextAreaElement, "Review package was updated and reassigned.");
      setControlValue(updateSelects[0] as HTMLSelectElement, "in_progress");
      setControlValue(updateSelects[1] as HTMLSelectElement, "normal");
      setControlValue(updateInputs[4] as HTMLInputElement, "conversation_beta");
      updateButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

    const taskLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open task");
    expect(taskLink?.getAttribute("href")).toBe("/tasks?instanceId=instance_alpha&taskId=task_alpha");
  });

  it("creates and updates reminders against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/reminders?instanceId=instance_alpha&reminderId=reminder_alpha",
      element: <RemindersPage />,
      session: adminSession,
    }));
    await flushEffects();

    const createForm = getFormByText("Create reminder");
    const updateForm = getFormByText("Save reminder");
    const createInputs = Array.from(createForm?.querySelectorAll("input") ?? []);
    const createTextareas = Array.from(createForm?.querySelectorAll("textarea") ?? []);
    const createButton = getButtonByText(createForm!, "Create reminder");

    await act(async () => {
      setControlValue(createInputs[0] as HTMLInputElement, "reminder_beta");
      setControlValue(createInputs[1] as HTMLInputElement, "task_beta");
      setControlValue(createInputs[3] as HTMLInputElement, "Escalation reminder");
      setControlValue(createTextareas[0] as HTMLTextAreaElement, "Escalate the follow-up if no response lands.");
      setControlValue(createInputs[4] as HTMLInputElement, "2026-04-23T13:30:00Z");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createReminderMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      reminder_id: "reminder_beta",
      task_id: "task_beta",
      title: "Escalation reminder",
      summary: "Escalate the follow-up if no response lands.",
      due_at: "2026-04-23T13:30:00Z",
    }));

    const updateInputs = Array.from(updateForm?.querySelectorAll("input") ?? []);
    const updateTextareas = Array.from(updateForm?.querySelectorAll("textarea") ?? []);
    const updateSelects = Array.from(updateForm?.querySelectorAll("select") ?? []);
    const updateButton = getButtonByText(updateForm!, "Save reminder");

    await act(async () => {
      setControlValue(updateInputs[0] as HTMLInputElement, "task_beta");
      setControlValue(updateInputs[1] as HTMLInputElement, "notification_beta");
      setControlValue(updateInputs[2] as HTMLInputElement, "Price reminder updated");
      setControlValue(updateTextareas[0] as HTMLTextAreaElement, "Reminder updated after operator review.");
      setControlValue(updateSelects[0] as HTMLSelectElement, "due");
      setControlValue(updateInputs[3] as HTMLInputElement, "2026-04-23T14:00:00Z");
      setControlValue(updateInputs[4] as HTMLInputElement, "2026-04-23T13:45:00Z");
      updateButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
      limit: 100,
    });
    expect(fetchChannelDetailMock).toHaveBeenCalledWith("channel_primary", "instance_alpha");
    expect(container.textContent).toContain("Channel inventory");
    expect(container.textContent).toContain("Ops email");
    expect(container.textContent).toContain("Recent notifications");

    const fallbackLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open fallback channel");
    expect(fallbackLink?.getAttribute("href")).toBe("/channels?instanceId=instance_alpha&channelId=channel_fallback");
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
    const createInputs = Array.from(createForm?.querySelectorAll("input") ?? []);
    const createTextareas = Array.from(createForm?.querySelectorAll("textarea") ?? []);
    const createSelects = Array.from(createForm?.querySelectorAll("select") ?? []);
    const createButton = getButtonByText(createForm!, "Create channel");

    await act(async () => {
      setControlValue(createInputs[0] as HTMLInputElement, "channel_slack");
      setControlValue(createSelects[0] as HTMLSelectElement, "slack");
      setControlValue(createSelects[1] as HTMLSelectElement, "degraded");
      setControlValue(createInputs[1] as HTMLInputElement, "Ops Slack");
      setControlValue(createInputs[2] as HTMLInputElement, "#ops-alerts");
      setControlValue(createInputs[3] as HTMLInputElement, "channel_fallback");
      setControlValue(createTextareas[0] as HTMLTextAreaElement, "{\"tier\":\"secondary\"}");
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

    const updateInputs = Array.from(updateForm?.querySelectorAll("input") ?? []);
    const updateTextareas = Array.from(updateForm?.querySelectorAll("textarea") ?? []);
    const updateSelects = Array.from(updateForm?.querySelectorAll("select") ?? []);
    const updateButton = getButtonByText(updateForm!, "Save channel");

    await act(async () => {
      setControlValue(updateInputs[0] as HTMLInputElement, "Ops email updated");
      setControlValue(updateInputs[1] as HTMLInputElement, "ops-updated@example.com");
      setControlValue(updateSelects[0] as HTMLSelectElement, "degraded");
      setControlValue(updateInputs[2] as HTMLInputElement, "channel_fallback");
      setControlValue(updateTextareas[0] as HTMLTextAreaElement, "{\"tier\":\"primary\"}");
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

  it("renders the notifications page with channel, reminder, and retry truth", async () => {
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
    expect(container.textContent).toContain("Notification inventory");
    expect(container.textContent).toContain("Preview customer reply");
    expect(container.textContent).toContain("Retry count");

    const channelLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open channel");
    expect(channelLink?.getAttribute("href")).toBe("/channels?instanceId=instance_alpha&channelId=channel_primary");
  });

  it("creates, updates, confirms, rejects, and retries notifications against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/notifications?instanceId=instance_alpha&notificationId=notification_alpha",
      element: <NotificationsPage />,
      session: adminSession,
    }));
    await flushEffects();

    const createForm = getFormByText("Create notification");
    const updateForm = getFormByText("Save notification");
    const createInputs = Array.from(createForm?.querySelectorAll("input") ?? []);
    const createTextareas = Array.from(createForm?.querySelectorAll("textarea") ?? []);
    const createSelects = Array.from(createForm?.querySelectorAll("select") ?? []);
    const createButton = getButtonByText(createForm!, "Create notification");

    await act(async () => {
      setControlValue(createInputs[0] as HTMLInputElement, "notification_beta");
      setControlValue(createInputs[1] as HTMLInputElement, "task_beta");
      setControlValue(createInputs[2] as HTMLInputElement, "reminder_beta");
      setControlValue(createInputs[6] as HTMLInputElement, "channel_primary");
      setControlValue(createInputs[7] as HTMLInputElement, "channel_fallback");
      setControlValue(createInputs[8] as HTMLInputElement, "Escalate customer reply");
      setControlValue(createTextareas[0] as HTMLTextAreaElement, "Escalate the outbound customer response.");
      setControlValue(createSelects[0] as HTMLSelectElement, "critical");
      setControlValue(createSelects[1] as HTMLSelectElement, "no");
      setControlValue(createInputs[9] as HTMLInputElement, "3");
      setControlValue(createTextareas[1] as HTMLTextAreaElement, "{\"channel\":\"primary\"}");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createNotificationMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      notification_id: "notification_beta",
      task_id: "task_beta",
      reminder_id: "reminder_beta",
      channel_id: "channel_primary",
      fallback_channel_id: "channel_fallback",
      title: "Escalate customer reply",
      body: "Escalate the outbound customer response.",
      priority: "critical",
      preview_required: false,
      max_retries: 3,
      metadata: { channel: "primary" },
    }));

    const updateInputs = Array.from(updateForm?.querySelectorAll("input") ?? []);
    const updateTextareas = Array.from(updateForm?.querySelectorAll("textarea") ?? []);
    const updateSelects = Array.from(updateForm?.querySelectorAll("select") ?? []);
    const updateButton = getButtonByText(updateForm!, "Save notification");

    await act(async () => {
      setControlValue(updateInputs[0] as HTMLInputElement, "channel_primary");
      setControlValue(updateInputs[1] as HTMLInputElement, "channel_fallback");
      setControlValue(updateInputs[2] as HTMLInputElement, "Preview customer reply updated");
      setControlValue(updateTextareas[0] as HTMLTextAreaElement, "Updated outbound customer response preview.");
      setControlValue(updateSelects[0] as HTMLSelectElement, "queued");
      setControlValue(updateSelects[1] as HTMLSelectElement, "normal");
      setControlValue(updateSelects[2] as HTMLSelectElement, "no");
      setControlValue(updateInputs[3] as HTMLInputElement, "4");
      setControlValue(updateInputs[4] as HTMLInputElement, "Transient provider error");
      setControlValue(updateTextareas[1] as HTMLTextAreaElement, "{\"channel\":\"fallback\"}");
      updateButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

    const confirmButton = getButtonByText(container, "Confirm notification");
    const rejectButton = getButtonByText(container, "Reject notification");
    const retryButton = getButtonByText(container, "Retry notification");

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
    expect(container.textContent).toContain("Last trigger output");

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
    const createInputs = Array.from(createForm?.querySelectorAll("input") ?? []);
    const createTextareas = Array.from(createForm?.querySelectorAll("textarea") ?? []);
    const createSelects = Array.from(createForm?.querySelectorAll("select") ?? []);
    const createButton = getButtonByText(createForm!, "Create automation");

    await act(async () => {
      setControlValue(createInputs[0] as HTMLInputElement, "automation_beta");
      setControlValue(createSelects[0] as HTMLSelectElement, "create_notification");
      setControlValue(createInputs[1] as HTMLInputElement, "90");
      setControlValue(createInputs[2] as HTMLInputElement, "Escalation automation");
      setControlValue(createTextareas[0] as HTMLTextAreaElement, "Generate escalation notifications on a cadence.");
      setControlValue(createInputs[3] as HTMLInputElement, "2026-04-23T15:00:00Z");
      setControlValue(createInputs[4] as HTMLInputElement, "task_beta");
      setControlValue(createInputs[8] as HTMLInputElement, "channel_primary");
      setControlValue(createInputs[9] as HTMLInputElement, "channel_fallback");
      setControlValue(createSelects[1] as HTMLSelectElement, "no");
      setControlValue(createInputs[10] as HTMLInputElement, "Escalation task");
      setControlValue(createInputs[11] as HTMLInputElement, "Escalation notification");
      setControlValue(createTextareas[1] as HTMLTextAreaElement, "Create the escalation task with the latest context.");
      setControlValue(createTextareas[2] as HTMLTextAreaElement, "Escalate this work item immediately.");
      setControlValue(createTextareas[3] as HTMLTextAreaElement, "{\"cadence\":\"tight\"}");
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

    const updateInputs = Array.from(updateForm?.querySelectorAll("input") ?? []);
    const updateTextareas = Array.from(updateForm?.querySelectorAll("textarea") ?? []);
    const updateSelects = Array.from(updateForm?.querySelectorAll("select") ?? []);
    const updateButton = getButtonByText(updateForm!, "Save automation");

    await act(async () => {
      setControlValue(updateInputs[0] as HTMLInputElement, "Follow up cadence updated");
      setControlValue(updateTextareas[0] as HTMLTextAreaElement, "Recurring rule updated after audit.");
      setControlValue(updateSelects[0] as HTMLSelectElement, "paused");
      setControlValue(updateInputs[1] as HTMLInputElement, "120");
      setControlValue(updateInputs[2] as HTMLInputElement, "2026-04-23T16:00:00Z");
      setControlValue(updateInputs[6] as HTMLInputElement, "ws_beta");
      setControlValue(updateInputs[7] as HTMLInputElement, "channel_fallback");
      setControlValue(updateSelects[1] as HTMLSelectElement, "no");
      setControlValue(updateTextareas[3] as HTMLTextAreaElement, "{\"cadence\":\"paused\"}");
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

    const triggerButton = getButtonByText(container, "Trigger automation");
    await act(async () => {
      triggerButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(triggerAutomationMock).toHaveBeenCalledWith("instance_alpha", "automation_alpha");
  });
});
