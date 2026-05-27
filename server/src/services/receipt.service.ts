import { Message } from "../models/message.model.js";
import { Conversation } from "../models/conversation.model.js";

/**
 * Receipt transitions. A message's aggregate `status` advances to "delivered"
 * (or "read") only once EVERY other participant has had it delivered (or read).
 * This works for direct chats (one other participant) and groups alike.
 *
 * Each function records the per-recipient fact (deliveredTo / readBy) and
 * returns the ids of messages whose AGGREGATE status actually changed, so we
 * only broadcast meaningful receipt updates.
 */

async function otherParticipantIds(conversationId: string): Promise<string[]> {
  const convo = await Conversation.findById(conversationId).select("participants");
  return convo ? convo.participants.map(String) : [];
}

/** Records delivery to `userId`; flips status to "delivered" when all have it. */
export async function markDelivered(
  conversationId: string,
  userId: string
): Promise<string[]> {
  const participantIds = await otherParticipantIds(conversationId);

  const msgs = await Message.find({
    conversationId,
    senderId: { $ne: userId },
    status: "sent",
    deliveredTo: { $ne: userId },
  });

  const changed: string[] = [];
  for (const m of msgs) {
    m.deliveredTo.push(userId as never);
    const recipients = participantIds.filter((id) => id !== String(m.senderId));
    const delivered = new Set(m.deliveredTo.map(String));
    if (recipients.every((id) => delivered.has(id))) {
      m.status = "delivered";
      changed.push(String(m._id));
    }
    await m.save();
  }
  return changed;
}

/** Records read by `userId`; flips status to "read" when all have read. */
export async function markRead(
  conversationId: string,
  userId: string
): Promise<string[]> {
  const participantIds = await otherParticipantIds(conversationId);

  const msgs = await Message.find({
    conversationId,
    senderId: { $ne: userId },
    status: { $in: ["sent", "delivered"] },
    "readBy.userId": { $ne: userId },
  });

  const changed: string[] = [];
  for (const m of msgs) {
    m.readBy.push({ userId, readAt: new Date() } as never);
    if (!m.deliveredTo.map(String).includes(userId)) {
      m.deliveredTo.push(userId as never); // reading implies delivered
    }
    const recipients = participantIds.filter((id) => id !== String(m.senderId));
    const readers = new Set(m.readBy.map((r) => String(r.userId)));
    if (recipients.every((id) => readers.has(id))) {
      m.status = "read";
      changed.push(String(m._id));
    }
    await m.save();
  }
  return changed;
}
