import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { usePresenceStore } from "../store/presenceStore";
import { useUnreadStore } from "../store/unreadStore";
import { conversationTitle, otherParticipant } from "../utils/conversation";
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
      <p className="p-4 text-sm text-slate-400">
        No conversations yet. Start one with “New chat”.
      </p>
    );
  }

  return (
    <ul>
      {conversations.map((c) => {
        const title = conversationTitle(c, myId);
        const other = otherParticipant(c, myId);
        const isActive = c.id === activeId;
        return (
          <li key={c.id}>
            <button
              onClick={() => setActiveId(c.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100 ${
                isActive ? "bg-slate-100" : ""
              }`}
            >
              <Avatar
                name={title}
                online={c.type === "direct" && other ? online.has(other.id) : undefined}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{title}</p>
                <p className="truncate text-sm text-slate-500">
                  {c.lastMessage?.text || "No messages yet"}
                </p>
              </div>
              {unread[c.id] > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-xs font-semibold text-white">
                  {unread[c.id]}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
