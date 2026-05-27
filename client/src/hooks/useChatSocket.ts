import { useEffect } from "react";
import { connectSocket, disconnectSocket, emitRead, emitFocus } from "../socket/socket";
import { listConversations, getHistory } from "../api/conversations";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { usePresenceStore } from "../store/presenceStore";
import { useTypingStore } from "../store/typingStore";
import { useUnreadStore } from "../store/unreadStore";
import { messagePreview, showBrowserNotification } from "../utils/notify";
import { conversationTitle } from "../utils/conversation";
import type { Conversation, Message } from "../types";

interface PresenceState {
  online: string[];
}
interface PresencePayload {
  userId: string;
}
interface TypingPayload {
  conversationId: string;
  userId: string;
}
interface ReceiptPayload {
  conversationId: string;
  messageIds: string[];
  status: "delivered" | "read";
}
interface NotificationPayload {
  conversationId: string;
  unread: number;
  message: Message;
}

// Auto-clear a typing indicator if a typing:stop is ever missed.
const TYPING_TIMEOUT_MS = 4000;

/**
 * Owns the socket lifecycle for the authenticated area: connects on mount,
 * routes live events (messages, presence, typing) into the stores, and
 * disconnects on unmount.
 */
export function useChatSocket(): void {
  useEffect(() => {
    const socket = connectSocket();
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const onMessage = (m: Message) => {
      useChatStore.getState().addMessage(m);
      // If I'm viewing this conversation when someone else's message arrives,
      // it's read immediately.
      const { activeId } = useChatStore.getState();
      const myId = useAuthStore.getState().user?.id;
      if (m.conversationId === activeId && m.senderId !== myId) {
        emitRead(m.conversationId);
      }
    };
    const onConversation = (c: Conversation) =>
      useChatStore.getState().upsertConversation(c);
    const onConversationRemoved = ({ conversationId }: { conversationId: string }) =>
      useChatStore.getState().removeConversation(conversationId);
    const onReceipt = ({ conversationId, messageIds, status }: ReceiptPayload) =>
      useChatStore.getState().applyReceipt(conversationId, messageIds, status);

    const onNotification = ({ conversationId, unread, message }: NotificationPayload) => {
      // Ignore if we're actively viewing it (handles a focus/send race).
      const { activeId } = useChatStore.getState();
      if (conversationId === activeId && !document.hidden) return;

      useUnreadStore.getState().set(conversationId, unread);

      const convo = useChatStore
        .getState()
        .conversations.find((c) => c.id === conversationId);
      const myId = useAuthStore.getState().user?.id;
      const sender = convo?.participants.find((p) => p.id === message.senderId);
      const title = convo
        ? convo.type === "group"
          ? `${sender?.name ?? "Someone"} in ${conversationTitle(convo, myId)}`
          : (sender?.name ?? "New message")
        : "New message";
      showBrowserNotification(title, messagePreview(message));
    };

    const onPresenceState = ({ online }: PresenceState) =>
      usePresenceStore.getState().setOnline(online);
    const onPresenceOnline = ({ userId }: PresencePayload) =>
      usePresenceStore.getState().addOnline(userId);
    const onPresenceOffline = ({ userId }: PresencePayload) =>
      usePresenceStore.getState().removeOnline(userId);

    const onTypingStart = ({ conversationId, userId }: TypingPayload) => {
      useTypingStore.getState().startTyping(conversationId, userId);
      const key = `${conversationId}:${userId}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.set(
        key,
        setTimeout(() => {
          useTypingStore.getState().stopTyping(conversationId, userId);
          typingTimers.delete(key);
        }, TYPING_TIMEOUT_MS)
      );
    };
    const onTypingStop = ({ conversationId, userId }: TypingPayload) => {
      useTypingStore.getState().stopTyping(conversationId, userId);
      const key = `${conversationId}:${userId}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
    };

    socket.on("message:new", onMessage);
    socket.on("conversation:new", onConversation);
    socket.on("conversation:updated", onConversation);
    socket.on("conversation:removed", onConversationRemoved);
    socket.on("receipt:update", onReceipt);
    socket.on("notification:new", onNotification);
    socket.on("presence:state", onPresenceState);
    socket.on("presence:online", onPresenceOnline);
    socket.on("presence:offline", onPresenceOffline);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);

    // After a dropped connection reconnects, refresh state that may be stale
    // (missed messages, unread counts) and re-assert focus.
    const onReconnect = async () => {
      try {
        const { conversations, unread } = await listConversations();
        useChatStore.getState().setConversations(conversations);
        useUnreadStore.getState().setAll(unread);
        const activeId = useChatStore.getState().activeId;
        if (activeId) {
          const page = await getHistory(activeId);
          useChatStore
            .getState()
            .setMessages(activeId, page.messages, {
              hasMore: page.hasMore,
              nextBefore: page.nextBefore,
            });
          if (!document.hidden) emitFocus(activeId);
        }
      } catch {
        // Best-effort; the next reconnect will try again.
      }
    };
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.off("message:new", onMessage);
      socket.off("conversation:new", onConversation);
      socket.off("conversation:updated", onConversation);
      socket.off("conversation:removed", onConversationRemoved);
      socket.off("receipt:update", onReceipt);
      socket.off("notification:new", onNotification);
      socket.off("presence:state", onPresenceState);
      socket.off("presence:online", onPresenceOnline);
      socket.off("presence:offline", onPresenceOffline);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
      socket.io.off("reconnect", onReconnect);
      typingTimers.forEach((t) => clearTimeout(t));
      disconnectSocket();
    };
  }, []);
}
