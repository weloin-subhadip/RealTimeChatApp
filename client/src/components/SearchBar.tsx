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
    <div className="relative px-5 pb-3">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages…"
          className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {results.length > 0 && (
        <ul className="absolute left-5 right-5 z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-soft">
          {results.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => openResult(m)}
                className="block w-full px-4 py-2.5 text-left transition hover:bg-brand-50"
              >
                <p className="text-xs font-semibold text-brand-600">
                  {titleFor(m.conversationId)}
                </p>
                <p className="truncate text-sm text-slate-700">{m.text}</p>
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
