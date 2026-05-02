/**
 * Conversation domain API surface extracted from admin API.
 */
export {
  appendConversationMessage,
  createConversation,
  fetchConversationDetail,
  fetchConversations,
  updateConversation,
  type ConversationDetail,
  type ConversationEventRecord,
  type ConversationEventType,
  type ConversationMentionRecord,
  type ConversationMentionStatus,
  type ConversationMessageRecord,
  type ConversationMessageRole,
  type ConversationParticipantKind,
  type ConversationParticipantRecord,
  type ConversationParticipantStatus,
  type ConversationSessionKind,
  type ConversationSessionRecord,
  type ConversationStatus,
  type ConversationSummary,
  type ConversationThreadStatus,
  type ConversationThreadSummary,
} from "../admin/conversations";
