import { redis } from "../config/redis.js";

/**
 * Presence in Redis. A user may have several live sockets (multiple tabs or
 * devices), so we keep a per-user connection counter and a set of online users.
 * The user is "online" while the counter is > 0.
 *
 * Note: counters are best-effort and can leak if a process is killed mid-flight;
 * fine for this project. A production system would add TTLs / heartbeats.
 */
const countKey = (userId: string) => `presence:count:${userId}`;
const ONLINE_SET = "presence:online";

/** Records a new socket for the user; returns the resulting connection count. */
export async function addConnection(userId: string): Promise<number> {
  const count = await redis.incr(countKey(userId));
  if (count === 1) await redis.sadd(ONLINE_SET, userId);
  return count;
}

/** Drops a socket for the user; returns the remaining connection count (>= 0). */
export async function removeConnection(userId: string): Promise<number> {
  const count = await redis.decr(countKey(userId));
  if (count <= 0) {
    await redis.del(countKey(userId));
    await redis.srem(ONLINE_SET, userId);
    return 0;
  }
  return count;
}

export async function getOnlineUserIds(): Promise<string[]> {
  return redis.smembers(ONLINE_SET);
}

export async function isOnline(userId: string): Promise<boolean> {
  return (await redis.sismember(ONLINE_SET, userId)) === 1;
}
