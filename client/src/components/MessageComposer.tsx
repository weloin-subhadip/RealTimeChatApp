import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendMessage, sendMediaMessage, emitTyping } from "../socket/socket";
import { uploadFile, mediaTypeFromMime } from "../api/upload";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import type { Message } from "../types";

const TYPING_DEBOUNCE_MS = 2000;

/** Composer with text, file attachment, and voice recording. */
export default function MessageComposer({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isTyping = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recorder = useVoiceRecorder(async (blob, durationSec) => {
    await sendMedia(blob, `voice-${Date.now()}.webm`, durationSec);
  });

  function stopTyping() {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    if (isTyping.current) {
      isTyping.current = false;
      emitTyping(conversationId, false);
    }
  }
  function signalTyping() {
    if (!isTyping.current) {
      isTyping.current = true;
      emitTyping(conversationId, true);
    }
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(stopTyping, TYPING_DEBOUNCE_MS);
  }
  useEffect(() => () => stopTyping(), [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendMedia(file: File | Blob, filename: string, durationSec?: number) {
    setUploading(true);
    try {
      const media = await uploadFile(file, filename);
      if (durationSec !== undefined) media.durationSec = durationSec;
      await sendMediaMessage(conversationId, mediaTypeFromMime(media.mimeType), media);
    } catch {
      // Surfacing upload errors is Phase 8 polish.
    } finally {
      setUploading(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (file) await sendMedia(file, file.name);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    stopTyping();

    // Optimistic: show the message instantly, reconcile when the server echoes it.
    const clientId = `temp-${crypto.randomUUID()}`;
    const myId = useAuthStore.getState().user?.id ?? "";
    const optimistic: Message = {
      id: clientId,
      clientId,
      conversationId,
      senderId: myId,
      type: "text",
      text: trimmed,
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    useChatStore.getState().addMessage(optimistic);
    setText("");

    try {
      await sendMessage(conversationId, trimmed, clientId);
    } catch {
      useChatStore.getState().markMessageFailed(conversationId, clientId);
    }
  }

  if (recorder.recording) {
    return (
      <div className="flex items-center gap-3 border-t border-slate-200 p-3">
        <span className="flex items-center gap-2 text-sm text-red-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
          Recording…
        </span>
        <button
          onClick={recorder.stop}
          className="ml-auto rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white"
        >
          Stop & send
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-slate-200 p-3">
      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        onChange={onPickFile}
        className="hidden"
      />
      <button
        type="button"
        title="Attach image or PDF"
        onClick={() => fileInput.current?.click()}
        disabled={uploading}
        className="rounded-full px-2 py-2 text-lg hover:bg-slate-100 disabled:opacity-50"
      >
        📎
      </button>
      <button
        type="button"
        title="Record voice message"
        onClick={() => recorder.start()}
        disabled={uploading}
        className="rounded-full px-2 py-2 text-lg hover:bg-slate-100 disabled:opacity-50"
      >
        🎤
      </button>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          e.target.value.trim() ? signalTyping() : stopTyping();
        }}
        placeholder={uploading ? "Uploading…" : "Type a message…"}
        disabled={uploading}
        className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      <button
        type="submit"
        disabled={!text.trim() || uploading}
        className="rounded-full bg-slate-800 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
