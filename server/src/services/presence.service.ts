import { User } from "../models/user.model.js";
import {
  addConnection,
  removeConnection,
  getOnlineUserIds,
} from "../redis/presence.js";

interface ConnectResult {
  /** True only when this is the user's first live connection. */
  firstConnection: boolean;
  onlineUserIds: string[];
}

/** Call when a socket connects: updates presence + (if newly online) DB status. */
export async function onUserConnected(userId: string): Promise<ConnectResult> {
  const count = await addConnection(userId);
  const firstConnection = count === 1;
  if (firstConnection) {
    await User.findByIdAndUpdate(userId, { status: "online" });
  }
  return { firstConnection, onlineUserIds: await getOnlineUserIds() };
}

interface DisconnectResult {
  /** True only when the user's last connection just dropped. */
  lastDisconnect: boolean;
  lastSeen: Date | null;
}

/** Call when a socket disconnects: updates presence + (if now offline) lastSeen. */
export async function onUserDisconnected(
  userId: string
): Promise<DisconnectResult> {
  const count = await removeConnection(userId);
  if (count <= 0) {
    const lastSeen = new Date();
    await User.findByIdAndUpdate(userId, { status: "offline", lastSeen });
    return { lastDisconnect: true, lastSeen };
  }
  return { lastDisconnect: false, lastSeen: null };
}
