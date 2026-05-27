import { useRef, useState } from "react";

interface VoiceRecorder {
  recording: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Records audio via the MediaRecorder API. On stop, invokes onComplete with the
 * recorded Blob and its duration in seconds. Microphone permission is requested
 * on start; getUserMedia rejects if denied.
 */
export function useVoiceRecorder(
  onComplete: (blob: Blob, durationSec: number) => void
): VoiceRecorder {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      );
      stream.getTracks().forEach((t) => t.stop()); // release the mic
      onComplete(blob, durationSec);
    };

    startedAtRef.current = Date.now();
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return { recording, start, stop };
}
