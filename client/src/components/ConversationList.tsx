import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { usePresenceStore } from "../store/presenceStore";
import { useUnreadStore } from "../store/unreadStore";
import { conversationTitle, otherParticipant } from "../utils/conversation";
import { formatTime } from "../utils/time";
import Avatar from "./Avatar";

/** Sidebar list of conversations, newest activity first. */
export default function ConversationList() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const setActiveId = useChatStore((s) => s.setActiveId);
  const myId = useAuthStore((s) => s.user?.id);
  const online = usePresenceStore((s) => s.online);
  const unread = useUnreadStore((s) => s.counts);

  if (conversations.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-slate-400">
        No conversations yet.
        <br />
        Start one with the “+” button.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {conversations.map((c) => {
        const title = conversationTitle(c, myId);
        const other = otherParticipant(c, myId);
        const isActive = c.id === activeId;
        const count = unread[c.id] ?? 0;
        const preview =
          c.lastMessage?.text ||
          (c.lastMessage?.type && c.lastMessage.type !== "text"
            ? `📎 ${c.lastMessage.type}`
            : "No messages yet");
        return (
          <li key={c.id}>
            <button
              onClick={() => setActiveId(c.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                isActive
                  ? "bg-brand-500 text-white shadow-soft"
                  : "hover:bg-brand-50"
              }`}
            >
              <Avatar
                name={title}
                online={c.type === "direct" && other ? online.has(other.id) : undefined}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`truncate font-semibold ${
                      isActive ? "text-white" : "text-ink-900"
                    }`}
                  >
                    {title}
                  </p>
                  {c.lastMessage?.createdAt && (
                    <span
                      className={`shrink-0 text-[11px] ${
                        isActive ? "text-white/70" : "text-slate-400"
                      }`}
                    >
                      {formatTime(c.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`truncate text-sm ${
                      isActive ? "text-white/80" : "text-slate-500"
                    }`}
                  >
                    {preview}
                  </p>
                  {count > 0 && (
                    <span
                      className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                        isActive ? "bg-white text-brand-600" : "bg-brand-500 text-white"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
