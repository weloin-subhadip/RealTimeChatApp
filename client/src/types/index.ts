export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export type PresenceStatus = "online" | "offline";

export interface Participant {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status: PresenceStatus;
}

export interface LastMessage {
  text: string;
  senderId: string;
  type: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  participants: Participant[];
  name?: string;
  avatarUrl?: string;
  admins?: string[];
  createdBy?: string;
  lastMessage?: LastMessage;
  createdAt: string;
  updatedAt: string;
}

export type MessageType = "text" | "image" | "pdf" | "voice";

// "sending"/"failed" are client-only states for optimistic messages.
export type MessageStatus = "sending" | "failed" | "sent" | "delivered" | "read";

export interface MediaInfo {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  durationSec?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  text?: string;
  media?: MediaInfo;
  status: MessageStatus;
  /** Client-generated id for optimistic reconciliation (set by sender only). */
  clientId?: string;
  createdAt: string;
}
