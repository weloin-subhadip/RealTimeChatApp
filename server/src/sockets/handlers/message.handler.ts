import type { Server } from "socket.io";
import { z } from "zod";
import type { AuthedSocket } from "../socketAuth.js";
import { Conversation } from "../../models/conversation.model.js";
import { createMessage } from "../../services/message.service.js";
import { isOnline } from "../../redis/presence.js";
import { getFocus, incrUnread } from "../../redis/unread.js";
import { conversationRoom, userRoom } from "../rooms.js";
import { logger } from "../../utils/logger.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const textPayload = z.object({
  conversationId: objectId,
  type: z.literal("text").optional(),
  text: z.string().trim().min(1).max(5000),
  // Optional client-generated id, echoed back so the sender can reconcile its
  // optimistic placeholder with the persisted message.
  clientId: z.string().max(100).optional(),
});

const mediaPayload = z.object({
  conversationId: objectId,
  type: z.enum(["image", "pdf", "voice"]),
  media: z.object({
    // Must be a path produced by our own upload endpoint.
    url: z.string().regex(/^\/uploads\/[A-Za-z0-9._-]+$/),
    filename: z.string().max(255),
    mimeType: z.string().max(100),
    size: z.number().int().nonnegative(),
    durationSec: z.number().nonnegative().optional(),
  }),
});

const sendSchema = z.union([textPayload, mediaPayload]);

type Ack = (response: unknown) => void;

/**
 * message:send flow: validate -> authorize -> determine initial receipt status
 * (delivered if a recipient is already online, else sent) -> persist ->
 * broadcast message:new to the conversation room.
 */
export function registerMessageHandlers(io: Server, socket: AuthedSocket): void {
  socket.on("message:send", async (payload: unknown, ack?: Ack) => {
    const parsed = sendSchema.safeParse(payload);
    if (!parsed.success) return ack?.({ error: "Invalid message payload" });

    const data = parsed.data;
    const { conversationId } = data;
    try {
      const convo = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId,
      }).select("participants");
      if (!convo) return ack?.({ error: "Not a participant" });

      // Delivered to whichever other participants are currently online; the
      // aggregate is "delivered" only when that's ALL of them (groups included).
      const others = convo.participants
        .map(String)
        .filter((id) => id !== socket.userId);
      const onlineFlags = await Promise.all(others.map(isOnline));
      const onlineOthers = others.filter((_, i) => onlineFlags[i]);
      const allOnline = others.length > 0 && onlineOthers.length === others.length;

      const message = await createMessage({
        conversationId,
        senderId: socket.userId,
        type: "text" in data ? "text" : data.type,
        text: "text" in data ? data.text : undefined,
        media: "media" in data ? data.media : undefined,
        status: allOnline ? "delivered" : "sent",
        deliveredTo: onlineOthers,
      });

      // Echo the clientId back to the sender's room so it can reconcile its
      // optimistic placeholder; harmless for other recipients.
      const clientId = "clientId" in data ? data.clientId : undefined;
      const outgoing = clientId ? { ...message, clientId } : message;

      io.to(conversationRoom(conversationId)).emit("message:new", outgoing);
      ack?.({ ok: true, message: outgoing });

      // Unread + notification for recipients NOT currently viewing this chat.
      for (const recipientId of others) {
        if ((await getFocus(recipientId)) === conversationId) continue;
        const unread = await incrUnread(recipientId, conversationId);
        io.to(userRoom(recipientId)).emit("notification:new", {
          conversationId,
          unread,
          message,
        });
      }
    } catch (err) {
      logger.error("message:send failed:", err);
      ack?.({ error: "Failed to send message" });
    }
  });
}
