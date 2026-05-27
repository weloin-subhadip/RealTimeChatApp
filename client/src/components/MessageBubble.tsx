import type { Message } from "../types";
import { formatTime, formatDuration } from "../utils/time";

/** 🕐 sending, ! failed, ✓ sent, ✓✓ delivered (grey), ✓✓ read (blue). My msgs only. */
function Ticks({ status }: { status: Message["status"] }) {
  if (status === "sending") return <span className="text-slate-400">🕐</span>;
  if (status === "failed") return <span className="text-red-400" title="Failed to send">!</span>;
  if (status === "sent") return <span className="text-slate-400">✓</span>;
  return (
    <span className={status === "read" ? "text-sky-400" : "text-slate-400"}>
      ✓✓
    </span>
  );
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
          className="max-h-60 max-w-full rounded-lg"
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
}: {
  message: Message;
  mine: boolean;
  /** Shown above the bubble for others' messages in group chats. */
  senderName?: string;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
          mine
            ? "rounded-br-sm bg-slate-800 text-white"
            : "rounded-bl-sm bg-white text-slate-800 shadow-sm"
        }`}
      >
        {!mine && senderName && (
          <p className="mb-0.5 text-xs font-semibold text-slate-500">{senderName}</p>
        )}
        <MessageBody message={message} />
        <p
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            mine ? "text-slate-300" : "text-slate-400"
          }`}
        >
          {formatTime(message.createdAt)}
          {mine && <Ticks status={message.status} />}
        </p>
      </div>
    </div>
  );
}
