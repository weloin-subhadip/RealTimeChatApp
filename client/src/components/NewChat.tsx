import { useEffect, useState } from "react";
import { listUsers } from "../api/users";
import { createConversation, createGroup } from "../api/conversations";
import { useChatStore } from "../store/chatStore";
import { getApiErrorMessage } from "../api/client";
import type { Participant } from "../types";
import Avatar from "./Avatar";

type Mode = "direct" | "group";

/** Panel to start a direct chat or create a group. */
export default function NewChat({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("direct");
  const [users, setUsers] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const setActiveId = useChatStore((s) => s.setActiveId);

  useEffect(() => {
    listUsers().then(setUsers).catch((e) => setError(getApiErrorMessage(e)));
  }, []);

  function open(conversationId: string) {
    setActiveId(conversationId);
    onClose();
  }

  async function startDirect(participantId: string) {
    setBusy(true);
    try {
      const c = await createConversation(participantId);
      upsertConversation(c);
      open(c.id);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submitGroup() {
    if (!groupName.trim() || selected.size === 0) return;
    setBusy(true);
    try {
      const c = await createGroup(groupName.trim(), [...selected]);
      upsertConversation(c);
      open(c.id);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink-900/30 p-4 backdrop-blur-sm">
      <div className="w-[360px] rounded-3xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">New chat</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm">
          {(["direct", "group"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-1.5 font-medium capitalize transition ${
                mode === m ? "bg-white text-brand-600 shadow-soft" : "text-slate-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}

        {mode === "group" && (
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
            className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        )}

        {users.length === 0 ? (
          <p className="text-sm text-slate-400">No other users yet.</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {users.map((u) => {
              const checked = selected.has(u.id);
              return (
                <li key={u.id}>
                  <button
                    disabled={busy}
                    onClick={() => (mode === "direct" ? startDirect(u.id) : toggle(u.id))}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition disabled:opacity-50 ${
                      mode === "group" && checked ? "bg-brand-50" : "hover:bg-slate-50"
                    }`}
                  >
                    {mode === "group" && (
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs text-white ${
                          checked
                            ? "border-brand-500 bg-brand-500"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && "✓"}
                      </span>
                    )}
                    <Avatar name={u.name} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink-900">{u.name}</p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {mode === "group" && (
          <button
            onClick={submitGroup}
            disabled={busy || !groupName.trim() || selected.size === 0}
            className="mt-4 w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-600 disabled:opacity-40"
          >
            Create group ({selected.size})
          </button>
        )}
      </div>
    </div>
  );
}
