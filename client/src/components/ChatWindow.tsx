import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { usePresenceStore } from "../store/presenceStore";
import { useTypingStore } from "../store/typingStore";
import { getHistory } from "../api/conversations";
import { emitRead } from "../socket/socket";
import { conversationTitle, otherParticipant } from "../utils/conversation";
import Avatar from "./Avatar";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";
import GroupInfo from "./GroupInfo";

// Stable empty reference. A Zustand selector must NOT return a fresh array/object
// each call — useSyncExternalStore would see "new" state every render and loop
// infinitely (React error #185). Default outside the selector, not inside it.
const EMPTY_TYPERS: string[] = [];

export default function ChatWindow() {
  const activeId = useChatStore((s) => s.activeId);
  const conversation = useChatStore((s) =>
    s.conversations.find((c) => c.id === s.activeId)
  );
  const messages = useChatStore((s) =>
    s.activeId ? s.messagesByConv[s.activeId] : undefined
  );
  const setMessages = useChatStore((s) => s.setMessages);
  const myId = useAuthStore((s) => s.user?.id);
  const online = usePresenceStore((s) => s.online);
  const typingForActive = useTypingStore((s) =>
    activeId ? s.typing[activeId] : undefined
  );
  const typingHere = typingForActive ?? EMPTY_TYPERS;
  const [showInfo, setShowInfo] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const prependHeightRef = useRef<number | null>(null); // set when loading older
  const atBottomRef = useRef(true);
  const prevLenRef = useRef(0);
  const prevConvRef = useRef<string | null>(null);

  // Load the first page when a conversation is opened.
  useEffect(() => {
    if (!activeId) return;
    emitRead(activeId);
    if (useChatStore.getState().messagesByConv[activeId]) return;
    getHistory(activeId).then((page) =>
      setMessages(activeId, page.messages, {
        hasMore: page.hasMore,
        nextBefore: page.nextBefore,
      })
    );
  }, [activeId, setMessages]);

  // Scroll positioning: preserve on prepend, stick to bottom on new messages /
  // conversation switch, otherwise leave the user where they are.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const len = messages?.length ?? 0;

    if (prependHeightRef.current !== null) {
      el.scrollTop = el.scrollHeight - prependHeightRef.current;
      prependHeightRef.current = null;
    } else if (prevConvRef.current !== activeId) {
      el.scrollTop = el.scrollHeight;
      atBottomRef.current = true;
    } else if (len > prevLenRef.current && atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevLenRef.current = len;
    prevConvRef.current = activeId;
  }, [messages, activeId]);

  const loadOlder = useCallback(async () => {
    if (!activeId || loadingOlder) return;
    const pag = useChatStore.getState().paginationByConv[activeId];
    if (!pag?.hasMore) return;
    setLoadingOlder(true);
    prependHeightRef.current = containerRef.current?.scrollHeight ?? 0;
    try {
      const page = await getHistory(activeId, pag.nextBefore ?? undefined);
      useChatStore.getState().prependMessages(activeId, page.messages, {
        hasMore: page.hasMore,
        nextBefore: page.nextBefore,
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [activeId, loadingOlder]);

  function onScroll() {
    const el = containerRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (el.scrollTop < 80) void loadOlder();
  }

  if (!activeId || !conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-brand-50/40 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-brand-500 shadow-soft">
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-ink-900">Your messages</p>
          <p className="text-sm text-slate-400">Select a conversation to start chatting.</p>
        </div>
      </div>
    );
  }

  const isGroup = conversation.type === "group";
  const title = conversationTitle(conversation, myId);
  const other = otherParticipant(conversation, myId);
  const otherOnline = other ? online.has(other.id) : false;

  const nameOf = (id: string) =>
    conversation.participants.find((p) => p.id === id)?.name ?? "Unknown";
  const typers = typingHere.filter((id) => id !== myId);

  const typingActive = typers.length > 0;
  let status: string;
  if (typingActive) {
    status = isGroup
      ? `${typers.map(nameOf).join(", ")} ${typers.length > 1 ? "are" : "is"} typing…`
      : "typing…";
  } else {
    status = isGroup
      ? `${conversation.participants.length} members`
      : otherOnline
        ? "online"
        : "offline";
  }

  return (
    <div className="relative flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-100 bg-white px-6 py-4">
          <Avatar name={title} online={isGroup ? undefined : otherOnline} />
          <div className="min-w-0">
            <h2 className="truncate font-bold text-ink-900">{title}</h2>
            <p
              className={`truncate text-xs ${
                typingActive
                  ? "font-medium text-brand-500"
                  : isGroup
                    ? "text-slate-400"
                    : otherOnline
                      ? "text-emerald-500"
                      : "text-slate-400"
              }`}
            >
              {status}
            </p>
          </div>
          <button
            onClick={() => setShowInfo((v) => !v)}
            title={isGroup ? "Group info" : "Contact info"}
            className={`ml-auto flex h-10 w-10 items-center justify-center rounded-xl transition ${
              showInfo
                ? "bg-brand-500 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-brand-50 hover:text-brand-500"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>
        </header>

        <div
          ref={containerRef}
          onScroll={onScroll}
          className="flex-1 space-y-3 overflow-y-auto bg-brand-50/30 px-6 py-5"
        >
          {loadingOlder && (
            <p className="text-center text-xs text-slate-400">Loading…</p>
          )}
          {(messages ?? []).map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              mine={m.senderId === myId}
              senderName={isGroup ? nameOf(m.senderId) : undefined}
              showAvatar={isGroup}
            />
          ))}
        </div>

        <MessageComposer conversationId={activeId} />
      </div>

      {showInfo && (
        <GroupInfo
          conversation={conversation}
          onClose={() => setShowInfo(false)}
        />
      )}
    </div>
  );
}
