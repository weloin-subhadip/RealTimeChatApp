import { useEffect, useState } from "react";
import { listUsers } from "../api/users";
import { addMember, removeMember } from "../api/conversations";
import { getApiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import type { Conversation, Participant } from "../types";
import Avatar from "./Avatar";

/** Group details + member management. Admins can add/remove; anyone can leave. */
export default function GroupInfo({
  conversation,
  onClose,
}: {
  conversation: Conversation;
  onClose: () => void;
}) {
  const myId = useAuthStore((s) => s.user?.id);
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const removeConversation = useChatStore((s) => s.removeConversation);
  const [candidates, setCandidates] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = !!myId && (conversation.admins ?? []).includes(myId);
  const memberIds = new Set(conversation.participants.map((p) => p.id));

  useEffect(() => {
    if (isAdmin) {
      listUsers()
        .then((users) => setCandidates(users.filter((u) => !memberIds.has(u.id))))
        .catch((e) => setError(getApiErrorMessage(e)));
    }
    // memberIds changes with conversation; re-filter when participants change.
  }, [isAdmin, conversation.participants]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onAdd(userId: string) {
    try {
      upsertConversation(await addMember(conversation.id, userId));
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  async function onRemove(userId: string) {
    try {
      const updated = await removeMember(conversation.id, userId);
      if (userId === myId) {
        removeConversation(conversation.id); // I left
        onClose();
      } else {
        upsertConversation(updated);
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center bg-black/30 pt-16">
      <div className="w-80 rounded-xl bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">{conversation.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
          {conversation.participants.length} members
        </p>
        <ul className="max-h-52 overflow-y-auto">
          {conversation.participants.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Avatar name={p.name} />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">
                  {p.name} {p.id === myId && "(you)"}
                </p>
                {(conversation.admins ?? []).includes(p.id) && (
                  <p className="text-xs text-slate-400">admin</p>
                )}
              </div>
              {isAdmin && p.id !== myId && (
                <button
                  onClick={() => onRemove(p.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {isAdmin && candidates.length > 0 && (
          <>
            <p className="mb-1 mt-3 text-xs font-semibold uppercase text-slate-400">
              Add member
            </p>
            <ul className="max-h-32 overflow-y-auto">
              {candidates.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => onAdd(u.id)}
                    className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-slate-100"
                  >
                    <Avatar name={u.name} />
                    <span className="text-sm text-slate-800">{u.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          onClick={() => myId && onRemove(myId)}
          className="mt-4 w-full rounded border border-red-300 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Leave group
        </button>
      </div>
    </div>
  );
}
