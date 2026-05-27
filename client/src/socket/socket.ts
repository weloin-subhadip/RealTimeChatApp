import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../store/authStore";
import type { MediaInfo, Message, MessageType } from "../types";

/**
 * Single shared Socket.IO client. Connects to the same origin (Vite proxies
 * /socket.io to the backend). The access token is read fresh on every (re)connect
 * via the auth callback, so reconnections always use the current token.
 */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? "" }),
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

interface SendAck {
  ok?: boolean;
  message?: Message;
  error?: string;
}

/** Signals typing start/stop for a conversation. */
export function emitTyping(conversationId: string, isTyping: boolean): void {
  getSocket().emit(isTyping ? "typing:start" : "typing:stop", { conversationId });
}

/** Tells the server the current user has viewed (read) a conversation. */
export function emitRead(conversationId: string): void {
  getSocket().emit("message:read", { conversationId });
}

/** Tells the server which conversation the user is actively viewing (or none). */
export function emitFocus(conversationId: string | null): void {
  getSocket().emit("conversation:focus", { conversationId });
}

function emitSend(payload: Record<string, unknown>): Promise<Message> {
  return new Promise((resolve, reject) => {
    getSocket().emit("message:send", payload, (ack: SendAck) => {
      if (ack?.ok && ack.message) resolve(ack.message);
      else reject(new Error(ack?.error ?? "Failed to send message"));
    });
  });
}

/** Sends a text message and resolves with the persisted message (via ack). */
export function sendMessage(
  conversationId: string,
  text: string,
  clientId?: string
): Promise<Message> {
  return emitSend({ conversationId, text, clientId });
}

/** Sends a media message (image / pdf / voice). */
export function sendMediaMessage(
  conversationId: string,
  type: Exclude<MessageType, "text">,
  media: MediaInfo
): Promise<Message> {
  return emitSend({ conversationId, type, media });
}
