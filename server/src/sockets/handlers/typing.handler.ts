import { z } from "zod";
import type { AuthedSocket } from "../socketAuth.js";
import { conversationRoom } from "../rooms.js";

const schema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});

/**
 * Relays typing signals to the rest of the conversation room. Typing is
 * transient, so nothing is persisted; the receiver auto-clears the indicator
 * after a short timeout in case a typing:stop is ever missed.
 *
 * Authorization uses the in-memory room membership (the socket only joined
 * rooms it's a participant of) — no DB hit per keystroke.
 */
export function registerTypingHandlers(socket: AuthedSocket): void {
  const relay = (event: "typing:start" | "typing:stop") => (payload: unknown) => {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return;
    const room = conversationRoom(parsed.data.conversationId);
    if (!socket.rooms.has(room)) return;
    socket.to(room).emit(event, {
      conversationId: parsed.data.conversationId,
      userId: socket.userId,
    });
  };

  socket.on("typing:start", relay("typing:start"));
  socket.on("typing:stop", relay("typing:stop"));
}
