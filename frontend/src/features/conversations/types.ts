import type {
  ConversationMessageRole,
  ConversationSessionKind,
  ConversationStatus,
  TriageStatus,
  WorkItemPriority,
} from "../../api/admin";

/** Load state for async operations. */
export type LoadState = "idle" | "loading" | "success" | "error";

/** Options for the message direction lens selector. */
export const MESSAGE_DIRECTION_OPTIONS = ["all", "to_agent", "from_agent", "human", "system"] as const;

/** A single message direction filter value. */
export type MessageDirectionLens = typeof MESSAGE_DIRECTION_OPTIONS[number];

/** Options for the link lens selector. */
export const LINK_LENS_OPTIONS = ["all", "task", "run", "approval", "artifact", "workspace"] as const;

/** A single link lens filter value. */
export type ConversationLinkLens = typeof LINK_LENS_OPTIONS[number];

/** Status filter options. */
export const STATUS_OPTIONS: Array<ConversationStatus | "all"> = ["all", "open", "paused", "closed", "archived"];

/** Triage filter options. */
export const TRIAGE_OPTIONS: Array<TriageStatus | "all"> = ["all", "new", "relevant", "delegated", "blocked", "done"];

/** Priority options. */
export const PRIORITY_OPTIONS: WorkItemPriority[] = ["low", "normal", "high", "critical"];

/** Session kind options. */
export const SESSION_KIND_OPTIONS: ConversationSessionKind[] = ["runtime", "operator", "assistant", "external"];

/** Message role options. */
export const MESSAGE_ROLE_OPTIONS: ConversationMessageRole[] = ["user", "assistant", "system", "operator", "tool"];

/** A timeline entry that is either a message or a system event. */
export type TimelineItem =
  | {
    kind: "message";
    sortAt: string;
    threadId: string;
    message: import("../../api/admin").ConversationMessageRecord;
    mentions: import("../../api/admin").ConversationDetail["mentions"];
    events: import("../../api/admin").ConversationEventRecord[];
  }
  | {
    kind: "event";
    sortAt: string;
    threadId: string;
    event: import("../../api/admin").ConversationEventRecord;
  };

/** Form state for creating a new conversation. */
export type CreateConversationForm = {
  conversationId: string;
  workspaceId: string;
  subject: string;
  summary: string;
  triageStatus: TriageStatus;
  priority: WorkItemPriority;
  contactRef: string;
  runId: string;
  artifactId: string;
  approvalId: string;
  decisionId: string;
  metadataJson: string;
  initialThreadTitle: string;
  initialSessionKind: ConversationSessionKind;
  initialContinuityKey: string;
  initialMessageRole: ConversationMessageRole;
  initialMessageBody: string;
  participantAgentIds: string[];
  initialMentionAgentIds: string[];
  createInboxEntry: "yes" | "no";
  inboxTitle: string;
  inboxSummary: string;
};

/** Default values for the create conversation form. */
export const DEFAULT_CREATE_FORM: CreateConversationForm = {
  conversationId: "",
  workspaceId: "",
  subject: "",
  summary: "",
  triageStatus: "new",
  priority: "normal",
  contactRef: "",
  runId: "",
  artifactId: "",
  approvalId: "",
  decisionId: "",
  metadataJson: "{}",
  initialThreadTitle: "Primary",
  initialSessionKind: "operator",
  initialContinuityKey: "",
  initialMessageRole: "user",
  initialMessageBody: "",
  participantAgentIds: [],
  initialMentionAgentIds: [],
  createInboxEntry: "yes",
  inboxTitle: "",
  inboxSummary: "",
};

/** Form state for editing an existing conversation. */
export type EditConversationForm = {
  subject: string;
  summary: string;
  workspaceId: string;
  status: ConversationStatus;
  triageStatus: TriageStatus;
  priority: WorkItemPriority;
  contactRef: string;
  runId: string;
  artifactId: string;
  approvalId: string;
  decisionId: string;
  activeThreadId: string;
  metadataJson: string;
};

/** Default values for the edit conversation form. */
export const DEFAULT_EDIT_FORM: EditConversationForm = {
  subject: "",
  summary: "",
  workspaceId: "",
  status: "open",
  triageStatus: "new",
  priority: "normal",
  contactRef: "",
  runId: "",
  artifactId: "",
  approvalId: "",
  decisionId: "",
  activeThreadId: "",
  metadataJson: "{}",
};

/** Form state for appending a message to a conversation. */
export type AppendConversationForm = {
  threadId: string;
  sessionId: string;
  threadTitle: string;
  startNewSession: "yes" | "no";
  sessionKind: ConversationSessionKind;
  continuityKey: string;
  messageRole: ConversationMessageRole;
  structuredPayloadJson: string;
  body: string;
  mentionAgentIds: string[];
  handoffToAgentId: string;
  reviewRequestAgentId: string;
  blockerAgentId: string;
  roundtableAgentIds: string[];
};

/** Default values for the append message form. */
export const DEFAULT_APPEND_FORM: AppendConversationForm = {
  threadId: "",
  sessionId: "",
  threadTitle: "",
  startNewSession: "yes",
  sessionKind: "operator",
  continuityKey: "",
  messageRole: "operator",
  structuredPayloadJson: "{}",
  body: "",
  mentionAgentIds: [],
  handoffToAgentId: "",
  reviewRequestAgentId: "",
  blockerAgentId: "",
  roundtableAgentIds: [],
};
