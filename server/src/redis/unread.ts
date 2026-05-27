import { redis } from "../config/redis.js";

/**
 * Per-user unread counts (a Redis hash of conversationId -> count) and a "focus"
 * key holding the conversation the user currently has open AND visible. A
 * message only bumps unread / notifies recipients who are NOT focused on it.
 */
const unreadKey = (userId: string) => `unread:${userId}`;
const focusKey = (userId: string) => `focus:${userId}`;

export async function incrUnread(
  userId: string,
  conversationId: string
): Promise<number> {
  return redis.hincrby(unreadKey(userId), conversationId, 1);
}

export async function resetUnread(
  userId: string,
  conversationId: string
): Promise<void> {
  await redis.hdel(unreadKey(userId), conversationId);
}

/** conversationId -> unread count, for seeding the client on load. */
export async function getUnreadMap(
  userId: string
): Promise<Record<string, number>> {
  const raw = await redis.hgetall(unreadKey(userId));
  const map: Record<string, number> = {};
  for (const [id, count] of Object.entries(raw)) map[id] = Number(count);
  return map;
}

export async function setFocus(
  userId: string,
  conversationId: string
): Promise<void> {
  await redis.set(focusKey(userId), conversationId);
}

export async function clearFocus(userId: string): Promise<void> {
  await redis.del(focusKey(userId));
}

export async function getFocus(userId: string): Promise<string | null> {
  return redis.get(focusKey(userId));
}
