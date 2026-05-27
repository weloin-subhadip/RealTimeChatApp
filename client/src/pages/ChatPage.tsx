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
    <div className="relative flex h-full">
      <aside className="flex w-80 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="font-semibold text-slate-800">{user?.name}</span>
          <button
            onClick={onLogout}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Log out
          </button>
        </div>
        <button
          onClick={() => setShowNewChat(true)}
          className="m-3 rounded bg-slate-800 py-2 text-sm font-medium text-white"
        >
          + New chat
        </button>
        <SearchBar />
        <div className="flex-1 overflow-y-auto">
          <ConversationList />
        </div>
      </aside>

      <ChatWindow />

      {showNewChat && <NewChat onClose={() => setShowNewChat(false)} />}
    </div>
  );
}
