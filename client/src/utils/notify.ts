import type { Message } from "../types";

/** Short human-readable preview of a message, used in lists and notifications. */
export function messagePreview(message: Pick<Message, "type" | "text">): string {
  switch (message.type) {
    case "image":
      return "📷 Photo";
    case "pdf":
      return "📄 PDF";
    case "voice":
      return "🎤 Voice message";
    default:
      return message.text ?? "";
  }
}

/** Asks for browser notification permission once (no-op if unsupported/decided). */
export function requestNotificationPermission(): void {
  if ("Notification" in window && Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

/**
 * Shows an OS notification, but only when the tab is hidden and permission was
 * granted — an in-app badge already covers the visible case.
 */
export function showBrowserNotification(title: string, body: string): void {
  if (
    "Notification" in window &&
    Notification.permission === "granted" &&
    document.hidden
  ) {
    new Notification(title, { body });
  }
}
