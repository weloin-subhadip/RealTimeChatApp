import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { env } from "../config/env.js";
import { createPubSubClients } from "../config/redis.js";
import { logger } from "../utils/logger.js";
import { socketAuth, type AuthedSocket } from "./socketAuth.js";
import { setIO } from "./io.js";
import { conversationRoom, userRoom } from "./rooms.js";
import { getConversationIds } from "../services/conversation.service.js";
import {
  onUserConnected,
  onUserDisconnected,
} from "../services/presence.service.js";
import { registerMessageHandlers } from "./handlers/message.handler.js";
import { registerTypingHandlers } from "./handlers/typing.handler.js";
import {
  registerReceiptHandlers,
  deliverBacklogOnConnect,
} from "./handlers/receipt.handler.js";
import { registerFocusHandlers } from "./handlers/focus.handler.js";
import { clearFocus } from "../redis/unread.js";
import type { Socket } from "socket.io";

/** Joins a freshly-connected socket to a room for each of its conversations. */
async function joinConversationRooms(socket: Socket, userId: string): Promise<void> {
  const conversationIds = await getConversationIds(userId);
  for (const id of conversationIds) socket.join(conversationRoom(id));
}

/** Post-connect async work: rooms + presence. */
async function onConnect(io: SocketIOServer, socket: AuthedSocket): Promise<void> {
  const { userId } = socket;
  await joinConversationRooms(socket, userId);

  const { firstConnection, onlineUserIds } = await onUserConnected(userId);
  // Seed this socket with the current online snapshot...
  socket.emit("presence:state", { online: onlineUserIds });
  // ...and notify everyone else only when the user truly just came online.
  if (firstConnection) socket.broadcast.emit("presence:online", { userId });

  // Deliver any messages that arrived while this user was offline.
  await deliverBacklogOnConnect(io, userId);
}

/** Last-connection-drops handling: broadcast offline with lastSeen. */
async function onDisconnect(io: SocketIOServer, userId: string): Promise<void> {
  const { lastDisconnect, lastSeen } = await onUserDisconnected(userId);
  if (lastDisconnect) {
    await clearFocus(userId);
    io.emit("presence:offline", { userId, lastSeen });
  }
}

/**
 * Creates the Socket.IO server, attaches the Redis pub/sub adapter (so multiple
 * server instances can fan out events to each other), and registers connection
 * handling and JWT auth.
 */
export async function initSocket(httpServer: HttpServer): Promise<SocketIOServer> {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  // Cross-instance message fan-out via Redis.
  const { pubClient, subClient } = createPubSubClients();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  logger.info("Socket.IO Redis adapter attached");
  setIO(io);

  // Reject unauthenticated sockets at the handshake.
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const authed = socket as AuthedSocket;
    const { userId } = authed;
    logger.info(`Socket connected: ${socket.id} (user ${userId})`);

    // Register event handlers SYNCHRONOUSLY, before any await, so an event the
    // client emits immediately after connecting is never dropped.
    registerMessageHandlers(io, authed);
    registerTypingHandlers(authed);
    registerReceiptHandlers(io, authed);
    registerFocusHandlers(authed);

    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
      void onDisconnect(io, userId);
    });

    // Join the personal room, then conversation rooms + presence (async).
    socket.join(userRoom(userId));
    void onConnect(io, authed);
  });

  return io;
}
