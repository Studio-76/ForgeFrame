import type { AgentSummary, ConversationSummary } from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import type { ConversationLinkLens } from "./types";

/**
 * Parse a JSON string value into an object.
 * @param rawValue - The JSON string to parse.
 * @param fieldLabel - Label for error messages.
 * @returns The parsed object.
 * @throws {Error} If the value is not a valid JSON object.
 */
export function parseJsonObject(rawValue: string, fieldLabel: string): Record<string, unknown> {
  const normalized = rawValue.trim();
  if (!normalized) {
    return {};
  }
  const parsed = JSON.parse(normalized) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Build a URL path to the execution review page for a given run.
 * @param instanceId - The instance scope.
 * @param runId - The run identifier.
 * @returns The execution route path with query params.
 */
export function buildExecutionRoute(instanceId: string, runId: string): string {
  return `${CONTROL_PLANE_ROUTES.execution}?${new URLSearchParams({ instanceId, runId }).toString()}`;
}

/**
 * Build a URL path to the approvals page for a given approval.
 * @param instanceId - The instance scope.
 * @param approvalId - The approval identifier.
 * @returns The approvals route path with query params.
 */
export function buildApprovalRoute(instanceId: string, approvalId: string): string {
  return `${CONTROL_PLANE_ROUTES.approvals}?${new URLSearchParams({ instanceId, approvalId, status: "all" }).toString()}`;
}

/**
 * Check whether a conversation matches a given link lens filter.
 * @param conversation - The conversation to test.
 * @param linkLens - The link lens value.
 * @param conversationIdsWithTasks - Set of conversation IDs that have linked tasks.
 * @returns True if the conversation matches the lens.
 */
export function conversationMatchesLinkLens(
  conversation: ConversationSummary,
  linkLens: ConversationLinkLens,
  conversationIdsWithTasks: Set<string>,
): boolean {
  if (linkLens === "all") {
    return true;
  }
  if (linkLens === "task") {
    return conversationIdsWithTasks.has(conversation.conversation_id);
  }
  if (linkLens === "run") {
    return Boolean(conversation.run_id);
  }
  if (linkLens === "approval") {
    return Boolean(conversation.approval_id);
  }
  if (linkLens === "artifact") {
    return Boolean(conversation.artifact_id);
  }
  return Boolean(conversation.workspace_id);
}

/**
 * Resolve an agent ID to a display label.
 * @param agentId - The agent ID to look up.
 * @param agents - The list of agents to search.
 * @returns The agent display name or a fallback.
 */
export function resolveAgentLabel(agentId: string | null | undefined, agents: AgentSummary[]): string {
  if (!agentId) {
    return "Unassigned";
  }
  return agents.find((agent) => agent.agent_id === agentId)?.display_name ?? agentId;
}
