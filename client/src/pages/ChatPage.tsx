import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { listConversations } from "../api/conversations";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import { useUnreadStore } from "../store/unreadStore";
import { useChatSocket } from "../hooks/useChatSocket";
import { useFocusTracking } from "../hooks/useFocusTracking";
import { requestNotificationPermission } from "../utils/notify";
import ConversationList from "../components/ConversationList";
import ChatWindow from "../components/ChatWindow";
import NewChat from "../components/NewChat";
import SearchBar from "../components/SearchBar";
import Avatar from "../components/Avatar";

export default function ChatPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setConversations = useChatStore((s) => s.setConversations);
  const activeId = useChatStore((s) => s.activeId);
  const counts = useUnreadStore((s) => s.counts);
  const [showNewChat, setShowNewChat] = useState(false);

  // Connect the socket + route live events into the store.
  useChatSocket();
  // Report which conversation is in view (drives unread + notifications).
  useFocusTracking(activeId);

  // Load conversations + unread once on mount; ask for notification permission.
  useEffect(() => {
    listConversations().then(({ conversations, unread }) => {
      setConversations(conversations);
      useUnreadStore.getState().setAll(unread);
    });
    requestNotificationPermission();
  }, [setConversations]);

  // Reflect total unread in the tab title.
  useEffect(() => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    document.title = total > 0 ? `(${total}) RealTime Chat` : "RealTime Chat";
  }, [counts]);

  async function onLogout() {
    try {
      await logout();
    } finally {
      clearAuth();
      navigate("/login");
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-2 sm:p-4 lg:p-6">
      <div className="relative flex h-full max-h-[940px] w-full max-w-[1440px] overflow-hidden rounded-[28px] bg-white shadow-card ring-1 ring-black/5">
        {/* Slim dark icon rail */}
        <nav className="flex w-[72px] flex-col items-center gap-3 bg-ink-900 py-5">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-soft">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
              <path d="M12 3C6.48 3 2 6.94 2 11.8c0 2.2.92 4.2 2.45 5.74-.1 1.3-.52 2.6-1.36 3.66 1.6-.2 3-.74 4.06-1.5 1.46.58 3.1.9 4.85.9 5.52 0 10-3.94 10-8.8S17.52 3 12 3Z" />
            </svg>
          </div>

          <RailButton active label="Chats">
            <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
          </RailButton>
          <RailButton label="New chat" onClick={() => setShowNewChat(true)}>
            <path d="M12 5v14M5 12h14" />
          </RailButton>

          <div className="mt-auto flex flex-col items-center gap-3">
            <button
              title={user?.name}
              className="rounded-full ring-2 ring-transparent transition hover:ring-brand-400"
            >
              <Avatar name={user?.name ?? "?"} size={38} />
            </button>
            <button
              onClick={onLogout}
              title="Log out"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </nav>

        {/* Conversation list panel */}
        <aside className="flex w-[300px] flex-col border-r border-slate-100 bg-white">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div>
              <h1 className="text-lg font-bold text-ink-900">Messages</h1>
              <p className="text-xs text-slate-400">{user?.name}</p>
            </div>
            <button
              onClick={() => setShowNewChat(true)}
              title="New chat"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-soft transition hover:bg-brand-600"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          <SearchBar />
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <ConversationList />
          </div>
        </aside>

        <ChatWindow />

        {showNewChat && <NewChat onClose={() => setShowNewChat(false)} />}
      </div>
    </div>
  );
}

/** A single icon button in the dark rail. Children are <path> elements. */
function RailButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
        active
          ? "bg-brand-500/20 text-brand-300"
          : "text-slate-400 hover:bg-white/10 hover:text-white"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}
