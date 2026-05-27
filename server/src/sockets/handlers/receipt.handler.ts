import type { Server } from "socket.io";
import { z } from "zod";
import type { AuthedSocket } from "../socketAuth.js";
import { markDelivered, markRead } from "../../services/receipt.service.js";
import { getConversationIds } from "../../services/conversation.service.js";
import { conversationRoom } from "../rooms.js";
import { logger } from "../../utils/logger.js";

const schema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});

/** Notifies the conversation room that some messages changed receipt status. */
function emitReceipt(
  io: Server,
  conversationId: string,
  messageIds: string[],
  status: "delivered" | "read",
  by: string
): void {
  if (messageIds.length === 0) return;
  io.to(conversationRoom(conversationId)).emit("receipt:update", {
    conversationId,
    messageIds,
    status,
    by,
  });
}

/** Handles the client-driven read receipt (emitted when a user views a chat). */
export function registerReceiptHandlers(io: Server, socket: AuthedSocket): void {
  socket.on("message:read", async (payload: unknown) => {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return;
    const room = conversationRoom(parsed.data.conversationId);
    if (!socket.rooms.has(room)) return;
    try {
      const ids = await markRead(parsed.data.conversationId, socket.userId);
      emitReceipt(io, parsed.data.conversationId, ids, "read", socket.userId);
    } catch (err) {
      logger.error("message:read failed:", err);
    }
  });
}

/**
 * When a user comes online, deliver any backlog: mark still-"sent" messages in
 * their conversations as delivered and tell each room, so senders' ticks update.
 */
export async function deliverBacklogOnConnect(
  io: Server,
  userId: string
): Promise<void> {
  const conversationIds = await getConversationIds(userId);
  for (const conversationId of conversationIds) {
    const ids = await markDelivered(conversationId, userId);
    emitReceipt(io, conversationId, ids, "delivered", userId);
  }
}
