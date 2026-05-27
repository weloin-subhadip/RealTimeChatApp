import type { CookieOptions, Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import { AppError } from "../middleware/errorHandler.js";
import { env } from "../config/env.js";

const REFRESH_COOKIE = "refreshToken";

/**
 * The refresh token lives in an httpOnly cookie scoped to /api/auth, so it is
 * never readable by JS (XSS-safe) and is only sent to the refresh/logout
 * routes. The access token is returned in the JSON body and held in memory by
 * the client.
 */
const refreshCookieOpts: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
  path: "/api/auth",
};

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.register(
    name,
    email,
    password
  );
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
  res.status(201).json({ user, accessToken });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login(
    email,
    password
  );
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
  res.json({ user, accessToken });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new AppError(401, "No refresh token");
  const { accessToken, refreshToken } = await authService.refresh(token);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
  res.json({ accessToken });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOpts);
  res.json({ ok: true });
}

export async function me(req: Request, res: Response) {
  const user = await authService.getMe(req.userId!);
  res.json({ user });
}
