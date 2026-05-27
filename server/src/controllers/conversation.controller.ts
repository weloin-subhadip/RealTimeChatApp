import type { Request, Response } from "express";
import { User } from "../models/user.model.js";
import { AppError } from "../middleware/errorHandler.js";
import * as convService from "../services/conversation.service.js";
import * as messageService from "../services/message.service.js";
import { getIO } from "../sockets/io.js";
import { conversationRoom, userRoom } from "../sockets/rooms.js";
import { getUnreadMap } from "../redis/unread.js";

export async function listConversations(req: Request, res: Response) {
  const conversations = await convService.listUserConversations(req.userId!);
  const unread = await getUnreadMap(req.userId!);
  res.json({ conversations, unread });
}

/** Get-or-create a direct conversation with another user. */
export async function createConversation(req: Request, res: Response) {
  const me = req.userId!;
  const { participantId } = req.body as { participantId: string };

  if (participantId === me) {
    throw new AppError(400, "Cannot start a conversation with yourself");
  }
  if (!(await User.exists({ _id: participantId }))) {
    throw new AppError(404, "User not found");
  }

  const { conversation, created } = await convService.getOrCreateDirect(
    me,
    participantId
  );

  // Make both users' live sockets join the room, and (if new) notify them so
  // their conversation list updates without a refresh.
  const io = getIO();
  for (const pid of [me, participantId]) {
    io.in(userRoom(pid)).socketsJoin(conversationRoom(conversation.id));
    if (created) io.to(userRoom(pid)).emit("conversation:new", conversation);
  }

  res.status(created ? 201 : 200).json({ conversation });
}

/** Creates a group; joins every member's sockets and notifies them. */
export async function createGroup(req: Request, res: Response) {
  const me = req.userId!;
  const { name, memberIds } = req.body as { name: string; memberIds: string[] };
  const conversation = await convService.createGroup(me, name, memberIds);

  const io = getIO();
  for (const p of conversation.participants) {
    io.in(userRoom(p.id)).socketsJoin(conversationRoom(conversation.id));
    io.to(userRoom(p.id)).emit("conversation:new", conversation);
  }
  res.status(201).json({ conversation });
}

/** Adds a member (admin only): notify existing room, then onboard the new member. */
export async function addMember(req: Request, res: Response) {
  const { id } = req.params;
  const { userId } = req.body as { userId: string };
  const conversation = await convService.addMember(id, req.userId!, userId);

  const io = getIO();
  io.to(conversationRoom(id)).emit("conversation:updated", conversation);
  io.in(userRoom(userId)).socketsJoin(conversationRoom(id));
  io.to(userRoom(userId)).emit("conversation:new", conversation);
  res.json({ conversation });
}

/** Removes a member (admin, or self-leave): tell them, evict them, update the rest. */
export async function removeMember(req: Request, res: Response) {
  const { id, userId } = req.params;
  const conversation = await convService.removeMember(id, req.userId!, userId);

  const io = getIO();
  io.to(userRoom(userId)).emit("conversation:removed", { conversationId: id });
  io.in(userRoom(userId)).socketsLeave(conversationRoom(id));
  io.to(conversationRoom(id)).emit("conversation:updated", conversation);
  res.json({ conversation });
}

/** Renames a group (admin only). */
export async function renameGroup(req: Request, res: Response) {
  const { id } = req.params;
  const { name } = req.body as { name: string };
  const conversation = await convService.renameGroup(id, req.userId!, name);
  getIO().to(conversationRoom(id)).emit("conversation:updated", conversation);
  res.json({ conversation });
}

/** Paginated message history for a conversation the requester belongs to. */
export async function getHistory(req: Request, res: Response) {
  const { id } = req.params;
  if (!(await convService.isParticipant(id, req.userId!))) {
    throw new AppError(403, "Not a participant of this conversation");
  }
  const before = typeof req.query.before === "string" ? req.query.before : undefined;
  res.json(await messageService.getHistory(id, before));
}
