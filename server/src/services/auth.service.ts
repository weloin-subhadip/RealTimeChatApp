import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { User, toPublicUser, type PublicUser } from "../models/user.model.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getTokenTtlSeconds,
} from "../utils/jwt.js";
import {
  storeRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
} from "../redis/tokens.js";

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const SALT_ROUNDS = 10;

/** Mints a fresh access+refresh pair and records the refresh token in Redis. */
async function issueTokens(userId: string): Promise<TokenPair> {
  const jti = randomUUID();
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId, jti);
  await storeRefreshToken(userId, jti, getTokenTtlSeconds(refreshToken));
  return { accessToken, refreshToken };
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<AuthResult> {
  if (await User.findOne({ email })) {
    throw new AppError(409, "Email already registered");
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });
  return { user: toPublicUser(user), ...(await issueTokens(String(user._id))) };
}

export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, "Invalid email or password");
  }
  return { user: toPublicUser(user), ...(await issueTokens(String(user._id))) };
}

/** Validates a refresh token, rotates it, and returns a new token pair. */
export async function refresh(refreshToken: string): Promise<TokenPair> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid refresh token");
  }
  if (!(await isRefreshTokenValid(payload.sub, payload.jti))) {
    throw new AppError(401, "Refresh token revoked or expired");
  }
  await revokeRefreshToken(payload.sub, payload.jti); // rotation
  return issueTokens(payload.sub);
}

export async function logout(refreshToken?: string): Promise<void> {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await revokeRefreshToken(payload.sub, payload.jti);
  } catch {
    // Token already invalid/expired — nothing to revoke.
  }
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found");
  return toPublicUser(user);
}
