import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

/**
 * One shared Redis client for app data (presence, typing, unread counts,
 * refresh tokens). The Socket.IO pub/sub adapter needs its OWN dedicated
 * pub/sub pair of connections — created on demand via createPubSubClients().
 */
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error("Redis error:", err));

/** Establishes the shared client's connection. */
export async function connectRedis(): Promise<void> {
  await redis.connect();
}

/**
 * Socket.IO's Redis adapter requires two separate connections (one to publish,
 * one to subscribe). We duplicate the shared client so they share config.
 */
export function createPubSubClients() {
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();
  return { pubClient, subClient };
}
