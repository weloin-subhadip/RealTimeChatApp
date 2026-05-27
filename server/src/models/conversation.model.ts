import {
  Schema,
  model,
  Types,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";

const conversationSchema = new Schema(
  {
    type: { type: String, enum: ["direct", "group"], default: "direct" },
    participants: [
      { type: Schema.Types.ObjectId, ref: "User", required: true },
    ],
    // Group-only fields (used in Phase 6).
    name: { type: String },
    avatarUrl: { type: String },
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    // Denormalized for the conversation list, so it needs no message join.
    lastMessage: {
      type: new Schema(
        {
          text: String,
          senderId: { type: Schema.Types.ObjectId, ref: "User" },
          type: String,
          createdAt: Date,
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

export type ConversationDocument = HydratedDocument<
  InferSchemaType<typeof conversationSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

/** Shape of a participant once populated. */
interface PopulatedUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  avatarUrl?: string;
  status: "online" | "offline";
}

export interface PublicParticipant {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status: "online" | "offline";
}

export interface PublicConversation {
  id: string;
  type: "direct" | "group";
  participants: PublicParticipant[];
  name?: string;
  avatarUrl?: string;
  admins?: string[];
  createdBy?: string;
  lastMessage?: {
    text: string;
    senderId: string;
    type: string;
    createdAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

/** Maps a conversation with POPULATED participants to its public DTO. */
export function toPublicConversation(
  c: ConversationDocument
): PublicConversation {
  const participants = (c.participants as unknown as PopulatedUser[]).map(
    (u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl ?? undefined,
      status: u.status,
    })
  );
  return {
    id: String(c._id),
    type: c.type,
    participants,
    name: c.name ?? undefined,
    avatarUrl: c.avatarUrl ?? undefined,
    admins: c.admins?.map(String),
    createdBy: c.createdBy ? String(c.createdBy) : undefined,
    lastMessage: c.lastMessage
      ? {
          text: c.lastMessage.text ?? "",
          senderId: String(c.lastMessage.senderId),
          type: c.lastMessage.type ?? "text",
          createdAt: c.lastMessage.createdAt as Date,
        }
      : undefined,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export const Conversation = model("Conversation", conversationSchema);
