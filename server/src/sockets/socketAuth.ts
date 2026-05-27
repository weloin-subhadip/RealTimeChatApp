import type { Socket, ExtendedError } from "socket.io";
import { verifyAccessToken } from "../utils/jwt.js";

/** A socket that has passed authentication carries the user's id. */
export interface AuthedSocket extends Socket {
  userId: string;
}

/**
 * Socket.IO connection middleware. The client passes its access token in the
 * handshake auth payload: io(url, { auth: { token } }). Rejecting here prevents
 * unauthenticated sockets from ever connecting.
 */
export function socketAuth(
  socket: Socket,
  next: (err?: ExtendedError) => void
): void {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error("Authentication required"));
  try {
    const payload = verifyAccessToken(token);
    (socket as AuthedSocket).userId = payload.sub;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
}
