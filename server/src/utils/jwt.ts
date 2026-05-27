import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

/** Payload carried by the short-lived access token. `sub` = user id. */
export interface AccessTokenPayload {
  sub: string;
}

/** Payload carried by the long-lived refresh token. `jti` = unique token id. */
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

const accessOpts: SignOptions = {
  expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
};
const refreshOpts: SignOptions = {
  expiresIn: env.REFRESH_TOKEN_TTL as SignOptions["expiresIn"],
};

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, accessOpts);
}

export function signRefreshToken(userId: string, jti: string): string {
  return jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, refreshOpts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string") throw new Error("Malformed access token");
  return decoded as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof decoded === "string") throw new Error("Malformed refresh token");
  return decoded as RefreshTokenPayload;
}

/**
 * Remaining lifetime of a token in seconds, derived from its `exp` claim.
 * Used to give the Redis refresh-token record the same TTL as the token.
 */
export function getTokenTtlSeconds(token: string): number {
  const decoded = jwt.decode(token);
  if (decoded && typeof decoded === "object" && typeof decoded.exp === "number") {
    return Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0);
  }
  return 0;
}
