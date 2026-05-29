import { useEffect, useState } from "react";
import { listUsers } from "../api/users";
import { addMember, removeMember } from "../api/conversations";
import { getApiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import { usePresenceStore } from "../store/presenceStore";
import { conversationTitle, otherParticipant } from "../utils/conversation";
import type { Conversation, Participant } from "../types";
import Avatar from "./Avatar";

/**
 * Docked right-hand info panel. For groups: members + add/remove + leave.
 * For direct chats: the contact's profile. Both show shared files/media.
 */
export default function GroupInfo({
  conversation,
  onClose,
}: {
  conversation: Conversation;
  onClose: () => void;
}) {
  const myId = useAuthStore((s) => s.user?.id);
  const online = usePresenceStore((s) => s.online);
  const messages = useChatStore((s) => s.messagesByConv[conversation.id]);
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const removeConversation = useChatStore((s) => s.removeConversation);
  const [candidates, setCandidates] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isGroup = conversation.type === "group";
  const isAdmin = !!myId && (conversation.admins ?? []).includes(myId);
  const memberIds = new Set(conversation.participants.map((p) => p.id));
  const title = conversationTitle(conversation, myId);
  const other = otherParticipant(conversation, myId);

  // Media shared in this conversation, newest first (for the Files grid).
  const mediaMsgs = (messages ?? [])
    .filter((m) => m.media && (m.type === "image" || m.type === "pdf"))
    .slice()
    .reverse();

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
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-slate-100 bg-white">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="font-bold text-ink-900">
          {isGroup ? "Group Info" : "Contact Info"}
        </h2>
        <button
          onClick={onClose}
          title="Hide panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {/* Profile header */}
        <div className="flex flex-col items-center gap-2 pb-5 text-center">
          <Avatar
            name={title}
            size={84}
            online={!isGroup && other ? online.has(other.id) : undefined}
          />
          <div>
            <p className="text-lg font-bold text-ink-900">{title}</p>
            <p className="text-xs text-slate-400">
              {isGroup
                ? `${conversation.participants.length} members`
                : other && online.has(other.id)
                  ? "Online"
                  : "Offline"}
            </p>
          </div>
        </div>

        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}

        {/* Shared files / media */}
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Files &amp; Media
        </p>
        {mediaMsgs.length === 0 ? (
          <p className="mb-5 rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
            No shared files yet.
          </p>
        ) : (
          <div className="mb-5 grid grid-cols-3 gap-2">
            {mediaMsgs.slice(0, 9).map((m) => (
              <a
                key={m.id}
                href={m.media!.url}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100"
                title={m.media!.filename}
              >
                {m.type === "image" ? (
                  <img
                    src={m.media!.url}
                    alt={m.media!.filename}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl">
                    📄
                  </span>
                )}
              </a>
            ))}
          </div>
        )}

        {/* Members (groups) */}
        {isGroup && (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {conversation.participants.length} Members
            </p>
            <ul className="space-y-1">
              {conversation.participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"
                >
                  <Avatar name={p.name} size={38} online={online.has(p.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {p.name} {p.id === myId && "(you)"}
                    </p>
                    {(conversation.admins ?? []).includes(p.id) && (
                      <p className="text-xs text-brand-500">Admin</p>
                    )}
                  </div>
                  {isAdmin && p.id !== myId && (
                    <button
                      onClick={() => onRemove(p.id)}
                      className="text-xs font-medium text-rose-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {isAdmin && candidates.length > 0 && (
              <>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Add member
                </p>
                <ul className="space-y-1">
                  {candidates.map((u) => (
                    <li key={u.id}>
                      <button
                        onClick={() => onAdd(u.id)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-brand-50"
                      >
                        <Avatar name={u.name} size={34} />
                        <span className="text-sm text-ink-900">{u.name}</span>
                        <span className="ml-auto text-lg leading-none text-brand-500">
                          +
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <button
              onClick={() => myId && onRemove(myId)}
              className="mt-5 w-full rounded-xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              Leave group
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
