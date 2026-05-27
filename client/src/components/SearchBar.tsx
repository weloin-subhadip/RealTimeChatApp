import { useEffect, useState } from "react";
import { searchMessages } from "../api/search";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { conversationTitle } from "../utils/conversation";
import type { Message } from "../types";

/** Debounced message search. Clicking a result opens its conversation. */
export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Message[]>([]);
  const conversations = useChatStore((s) => s.conversations);
  const setActiveId = useChatStore((s) => s.setActiveId);
  const myId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchMessages(q).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function titleFor(conversationId: string) {
    const convo = conversations.find((c) => c.id === conversationId);
    return convo ? conversationTitle(convo, myId) : "Conversation";
  }

  function openResult(m: Message) {
    setActiveId(m.conversationId);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="border-b border-slate-200 p-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search messages…"
        className="w-full rounded-full border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      {results.length > 0 && (
        <ul className="mt-2 max-h-60 overflow-y-auto rounded border border-slate-200">
          {results.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => openResult(m)}
                className="block w-full px-3 py-2 text-left hover:bg-slate-100"
              >
                <p className="text-xs font-semibold text-slate-500">
                  {titleFor(m.conversationId)}
                </p>
                <p className="truncate text-sm text-slate-800">{m.text}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-2 px-1 text-xs text-slate-400">No matches.</p>
      )}
    </div>
  );
}
