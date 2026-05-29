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
      <div className="flex items-center gap-3 border-t border-slate-100 bg-white px-6 py-4">
        <span className="flex items-center gap-2 text-sm font-medium text-rose-600">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" />
          Recording…
        </span>
        <button
          onClick={recorder.stop}
          className="ml-auto rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-rose-700"
        >
          Stop &amp; send
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 border-t border-slate-100 bg-white px-4 py-3.5"
    >
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
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-brand-50 hover:text-brand-500 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" />
        </svg>
      </button>
      <button
        type="button"
        title="Record voice message"
        onClick={() => recorder.start()}
        disabled={uploading}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-brand-50 hover:text-brand-500 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          e.target.value.trim() ? signalTyping() : stopTyping();
        }}
        placeholder={uploading ? "Uploading…" : "Type a message…"}
        disabled={uploading}
        className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <button
        type="submit"
        disabled={!text.trim() || uploading}
        title="Send"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-white shadow-soft transition hover:bg-brand-600 disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
        </svg>
      </button>
    </form>
  );
}
