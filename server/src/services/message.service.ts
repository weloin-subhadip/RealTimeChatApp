import {
  Message,
  toPublicMessage,
  type MediaInfo,
  type PublicMessage,
} from "../models/message.model.js";
import { Conversation } from "../models/conversation.model.js";

const DEFAULT_LIMIT = 30;

type MessageType = "text" | "image" | "pdf" | "voice";

interface CreateMessageParams {
  conversationId: string;
  senderId: string;
  type?: MessageType;
  text?: string;
  media?: MediaInfo;
  status?: "sent" | "delivered" | "read";
  deliveredTo?: string[];
}

/** Short label shown in the conversation list for non-text messages. */
function previewText(type: MessageType, text?: string): string {
  switch (type) {
    case "image":
      return "📷 Photo";
    case "pdf":
      return "📄 PDF";
    case "voice":
      return "🎤 Voice message";
    default:
      return text ?? "";
  }
}

/** Persists a message and updates the conversation's denormalized lastMessage. */
export async function createMessage(
  params: CreateMessageParams
): Promise<PublicMessage> {
  const type = params.type ?? "text";
  const message = await Message.create({
    conversationId: params.conversationId,
    senderId: params.senderId,
    type,
    text: params.text,
    media: params.media,
    status: params.status ?? "sent",
    deliveredTo: params.deliveredTo ?? [],
  });

  // Bumps updatedAt too (timestamps), so the conversation rises in the list.
  await Conversation.findByIdAndUpdate(params.conversationId, {
    lastMessage: {
      text: previewText(type, params.text),
      senderId: params.senderId,
      type,
      createdAt: message.createdAt,
    },
  });

  return toPublicMessage(message);
}

export interface HistoryPage {
  messages: PublicMessage[];
  hasMore: boolean;
  nextBefore: Date | null;
}

/**
 * Returns up to `limit` messages, oldest-first for display. `before` (an ISO
 * timestamp) pages backwards into older history.
 */
export async function getHistory(
  conversationId: string,
  before?: string,
  limit = DEFAULT_LIMIT
): Promise<HistoryPage> {
  const filter: Record<string, unknown> = { conversationId };
  if (before) filter.createdAt = { $lt: new Date(before) };

  // Fetch newest-first, grab one extra to detect more pages.
  const docs = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = docs.length > limit;
  const page = docs.slice(0, limit).reverse(); // oldest-first
  const messages = page.map(toPublicMessage);
  const nextBefore = hasMore && messages.length ? messages[0].createdAt : null;

  return { messages, hasMore, nextBefore };
}

/** Full-text-ish search across the user's conversations (text messages only). */
export async function searchMessages(
  userId: string,
  query: string,
  limit = 20
): Promise<PublicMessage[]> {
  const convos = await Conversation.find({ participants: userId }).select("_id");
  const ids = convos.map((c) => c._id);

  // Escape regex metacharacters so user input can't break or inject a pattern.
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const docs = await Message.find({
    conversationId: { $in: ids },
    type: "text",
    text: { $regex: safe, $options: "i" },
  })
    .sort({ createdAt: -1 })
    .limit(limit);

  return docs.map(toPublicMessage);
}
