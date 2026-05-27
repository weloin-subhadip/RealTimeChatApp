import type { Conversation, Participant } from "../types";

/** The "other" participant of a direct conversation (relative to me). */
export function otherParticipant(
  conversation: Conversation,
  myId: string | undefined
): Participant | undefined {
  return conversation.participants.find((p) => p.id !== myId);
}

/** Display title for a conversation (group name, or the other person's name). */
export function conversationTitle(
  conversation: Conversation,
  myId: string | undefined
): string {
  if (conversation.type === "group") return conversation.name ?? "Group";
  return otherParticipant(conversation, myId)?.name ?? "Conversation";
}
