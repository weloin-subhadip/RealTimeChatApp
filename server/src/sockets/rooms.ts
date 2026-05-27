/**
 * Room naming conventions:
 * - user rooms receive cross-conversation events (e.g. conversation:new).
 * - conversation rooms receive that conversation's messages and events.
 */
export const userRoom = (userId: string) => `user:${userId}`;
export const conversationRoom = (conversationId: string) =>
  `conversation:${conversationId}`;
