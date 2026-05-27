import {
  Conversation,
  toPublicConversation,
  type ConversationDocument,
  type PublicConversation,
} from "../models/conversation.model.js";
import { User } from "../models/user.model.js";
import { AppError } from "../middleware/errorHandler.js";

const PARTICIPANT_FIELDS = "name email avatarUrl status";

async function populated(convo: ConversationDocument): Promise<PublicConversation> {
  await convo.populate("participants", PARTICIPANT_FIELDS);
  return toPublicConversation(convo);
}

function assertGroupAdmin(convo: ConversationDocument, userId: string): void {
  if (convo.type !== "group") throw new AppError(400, "Not a group conversation");
  if (!convo.admins?.map(String).includes(userId)) {
    throw new AppError(403, "Only group admins can do that");
  }
}

/** All conversations the user belongs to, newest activity first. */
export async function listUserConversations(
  userId: string
): Promise<PublicConversation[]> {
  const convos = await Conversation.find({ participants: userId })
    .sort({ updatedAt: -1 })
    .populate("participants", PARTICIPANT_FIELDS);
  return convos.map(toPublicConversation);
}

/** Conversation ids the user belongs to — used to join socket rooms on connect. */
export async function getConversationIds(userId: string): Promise<string[]> {
  const convos = await Conversation.find({ participants: userId }).select("_id");
  return convos.map((c) => String(c._id));
}

export async function isParticipant(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const convo = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  }).select("_id");
  return Boolean(convo);
}

/**
 * Finds the existing direct conversation between two users, or creates one.
 * Returns the populated DTO and whether it was newly created.
 */
export async function getOrCreateDirect(
  userId: string,
  otherId: string
): Promise<{ conversation: PublicConversation; created: boolean }> {
  let convo = await Conversation.findOne({
    type: "direct",
    participants: { $all: [userId, otherId], $size: 2 },
  });
  let created = false;

  if (!convo) {
    convo = await Conversation.create({
      type: "direct",
      participants: [userId, otherId],
      createdBy: userId,
    });
    created = true;
  }

  await convo.populate("participants", PARTICIPANT_FIELDS);
  return { conversation: toPublicConversation(convo), created };
}

/** Creates a group with the creator as the sole admin. */
export async function createGroup(
  creatorId: string,
  name: string,
  memberIds: string[]
): Promise<PublicConversation> {
  // De-duplicate, always include the creator.
  const participants = [...new Set([creatorId, ...memberIds])];
  if (participants.length < 2) {
    throw new AppError(400, "A group needs at least one other member");
  }
  const found = await User.countDocuments({ _id: { $in: participants } });
  if (found !== participants.length) {
    throw new AppError(404, "One or more members do not exist");
  }

  const convo = await Conversation.create({
    type: "group",
    name,
    participants,
    admins: [creatorId],
    createdBy: creatorId,
  });
  return populated(convo);
}

/** Adds a member to a group (admin only). Returns the updated + new-member ids. */
export async function addMember(
  conversationId: string,
  actorId: string,
  userId: string
): Promise<PublicConversation> {
  const convo = await Conversation.findById(conversationId);
  if (!convo) throw new AppError(404, "Conversation not found");
  assertGroupAdmin(convo, actorId);

  if (!(await User.exists({ _id: userId }))) {
    throw new AppError(404, "User not found");
  }
  if (convo.participants.map(String).includes(userId)) {
    throw new AppError(409, "Already a member");
  }
  convo.participants.push(userId as never);
  await convo.save();
  return populated(convo);
}

/** Removes a member (admin can remove anyone; a member can remove themselves). */
export async function removeMember(
  conversationId: string,
  actorId: string,
  userId: string
): Promise<PublicConversation> {
  const convo = await Conversation.findById(conversationId);
  if (!convo) throw new AppError(404, "Conversation not found");
  if (convo.type !== "group") throw new AppError(400, "Not a group conversation");

  const isSelfLeave = actorId === userId;
  if (!isSelfLeave) assertGroupAdmin(convo, actorId);
  if (!convo.participants.map(String).includes(userId)) {
    throw new AppError(404, "Not a member");
  }

  convo.participants = convo.participants.filter(
    (p) => String(p) !== userId
  ) as never;
  convo.admins = convo.admins?.filter((a) => String(a) !== userId) as never;
  await convo.save();
  return populated(convo);
}

/** Renames a group (admin only). */
export async function renameGroup(
  conversationId: string,
  actorId: string,
  name: string
): Promise<PublicConversation> {
  const convo = await Conversation.findById(conversationId);
  if (!convo) throw new AppError(404, "Conversation not found");
  assertGroupAdmin(convo, actorId);
  convo.name = name;
  await convo.save();
  return populated(convo);
}
