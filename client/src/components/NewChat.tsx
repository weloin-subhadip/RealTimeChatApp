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
    <div className="absolute inset-0 z-10 flex items-start justify-center bg-black/30 pt-16">
      <div className="w-80 rounded-xl bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">New chat</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="mb-3 flex rounded-lg bg-slate-100 p-1 text-sm">
          {(["direct", "group"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md py-1 capitalize ${
                mode === m ? "bg-white shadow-sm" : "text-slate-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        {mode === "group" && (
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
            className="mb-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        )}

        {users.length === 0 ? (
          <p className="text-sm text-slate-400">No other users yet.</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  disabled={busy}
                  onClick={() => (mode === "direct" ? startDirect(u.id) : toggle(u.id))}
                  className="flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-slate-100 disabled:opacity-50"
                >
                  {mode === "group" && (
                    <input type="checkbox" readOnly checked={selected.has(u.id)} />
                  )}
                  <Avatar name={u.name} />
                  <div>
                    <p className="font-medium text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {mode === "group" && (
          <button
            onClick={submitGroup}
            disabled={busy || !groupName.trim() || selected.size === 0}
            className="mt-3 w-full rounded bg-slate-800 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Create group ({selected.size})
          </button>
        )}
      </div>
    </div>
  );
}
