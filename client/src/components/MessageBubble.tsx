import type { Message } from "../types";
import { formatTime, formatDuration } from "../utils/time";
import Avatar from "./Avatar";

/** 🕐 sending, ! failed, ✓ sent, ✓✓ delivered, ✓✓ read. My msgs only. */
function Ticks({ status }: { status: Message["status"] }) {
  if (status === "sending") return <span className="opacity-70">🕐</span>;
  if (status === "failed")
    return (
      <span className="text-rose-200" title="Failed to send">
        !
      </span>
    );
  if (status === "sent") return <span className="opacity-70">✓</span>;
  return <span className={status === "read" ? "text-sky-200" : "opacity-70"}>✓✓</span>;
}

/** Renders the body of a message according to its type. */
function MessageBody({ message }: { message: Message }) {
  const { media } = message;

  if (message.type === "image" && media) {
    return (
      <a href={media.url} target="_blank" rel="noreferrer">
        <img
          src={media.url}
          alt={media.filename}
          className="max-h-72 max-w-full rounded-xl"
        />
      </a>
    );
  }

  if (message.type === "pdf" && media) {
    return (
      <a
        href={media.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 underline"
      >
        <span className="text-lg">📄</span>
        <span className="break-all">{media.filename}</span>
      </a>
    );
  }

  if (message.type === "voice" && media) {
    return (
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={media.url} className="h-9 max-w-[12rem]" />
        {media.durationSec !== undefined && (
          <span className="text-xs opacity-70">
            {formatDuration(media.durationSec)}
          </span>
        )}
      </div>
    );
  }

  return <p className="whitespace-pre-wrap break-words">{message.text}</p>;
}

/** A single message, aligned right when sent by the current user. */
export default function MessageBubble({
  message,
  mine,
  senderName,
  showAvatar,
}: {
  message: Message;
  mine: boolean;
  /** Shown above the bubble for others' messages in group chats. */
  senderName?: string;
  /** Render the sender avatar beside others' messages (group chats). */
  showAvatar?: boolean;
}) {
  const isMedia = message.type === "image";

  return (
    <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && showAvatar && senderName && (
        <Avatar name={senderName} size={32} />
      )}
      <div
        className={`max-w-[72%] px-3.5 py-2.5 text-sm shadow-soft ${
          isMedia ? "p-1.5" : ""
        } ${
          mine
            ? "rounded-2xl rounded-br-md bg-brand-500 text-white"
            : "rounded-2xl rounded-bl-md bg-white text-ink-900"
        }`}
      >
        {!mine && senderName && (
          <p
            className={`mb-0.5 text-xs font-semibold text-brand-500 ${
              isMedia ? "px-2 pt-1" : ""
            }`}
          >
            {senderName}
          </p>
        )}
        <MessageBody message={message} />
        <p
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            mine ? "text-white/70" : "text-slate-400"
          } ${isMedia ? "px-2 pb-1" : ""}`}
        >
          {formatTime(message.createdAt)}
          {mine && <Ticks status={message.status} />}
        </p>
      </div>
    </div>
  );
}
