import { redis } from "../config/redis.js";

/**
 * Refresh-token whitelist in Redis. Each valid refresh token is recorded as a
 * key with the token's own TTL. This gives us server-side revocation (logout)
 * and rotation: refreshing deletes the old record and stores a new one.
 */
const key = (userId: string, jti: string) => `refresh:${userId}:${jti}`;

export async function storeRefreshToken(
  userId: string,
  jti: string,
  ttlSeconds: number
): Promise<void> {
  await redis.set(key(userId, jti), "1", "EX", Math.max(ttlSeconds, 1));
}

export async function isRefreshTokenValid(
  userId: string,
  jti: string
): Promise<boolean> {
  return (await redis.exists(key(userId, jti))) === 1;
}

export async function revokeRefreshToken(
  userId: string,
  jti: string
): Promise<void> {
  await redis.del(key(userId, jti));
}
