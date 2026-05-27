import { z } from "zod";
import type { AuthedSocket } from "../socketAuth.js";
import { conversationRoom } from "../rooms.js";
import { setFocus, clearFocus, resetUnread } from "../../redis/unread.js";

const schema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable(),
});

/**
 * Tracks which conversation the user is actively viewing. The client emits this
 * when a conversation is opened (and on tab show/hide). Focusing a conversation
 * also clears its unread count.
 */
export function registerFocusHandlers(socket: AuthedSocket): void {
  socket.on("conversation:focus", async (payload: unknown) => {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return;

    const { conversationId } = parsed.data;
    if (conversationId === null) {
      await clearFocus(socket.userId);
      return;
    }
    if (!socket.rooms.has(conversationRoom(conversationId))) return;
    await setFocus(socket.userId, conversationId);
    await resetUnread(socket.userId, conversationId);
  });
}
