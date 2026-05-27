import type { Server } from "socket.io";

/**
 * Holds the Socket.IO server instance so non-socket code (e.g. REST
 * controllers) can emit events. Set once during startup in initSocket().
 */
let io: Server | null = null;

export function setIO(server: Server): void {
  io = server;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO has not been initialized");
  return io;
}
