import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";

const mediaSchema = new Schema(
  {
    url: String,
    filename: String,
    mimeType: String,
    size: Number,
    durationSec: Number,
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["text", "image", "pdf", "voice"],
      default: "text",
    },
    text: { type: String },
    // Populated for media messages in Phase 5.
    media: { type: mediaSchema, default: undefined },
    // Aggregate status: "delivered"/"read" mean ALL other participants have.
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    // Per-recipient tracking — needed to compute the aggregate in group chats.
    deliveredTo: [{ type: Schema.Types.ObjectId, ref: "User" }],
    readBy: [
      new Schema(
        {
          userId: { type: Schema.Types.ObjectId, ref: "User" },
          readAt: Date,
        },
        { _id: false }
      ),
    ],
  },
  { timestamps: true }
);

// Fast paginated history per conversation (newest-first).
messageSchema.index({ conversationId: 1, createdAt: -1 });

export type MessageDocument = HydratedDocument<
  InferSchemaType<typeof messageSchema> & { createdAt: Date; updatedAt: Date }
>;

export interface MediaInfo {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  durationSec?: number;
}

export interface PublicMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: "text" | "image" | "pdf" | "voice";
  text?: string;
  media?: MediaInfo;
  status: "sent" | "delivered" | "read";
  createdAt: Date;
}

export function toPublicMessage(m: MessageDocument): PublicMessage {
  return {
    id: String(m._id),
    conversationId: String(m.conversationId),
    senderId: String(m.senderId),
    type: m.type,
    text: m.text ?? undefined,
    media: m.media
      ? {
          url: m.media.url ?? "",
          filename: m.media.filename ?? "",
          mimeType: m.media.mimeType ?? "",
          size: m.media.size ?? 0,
          durationSec: m.media.durationSec ?? undefined,
        }
      : undefined,
    status: m.status,
    createdAt: m.createdAt,
  };
}

export const Message = model("Message", messageSchema);
