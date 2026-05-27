import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

/** Connects to MongoDB. Throws on failure so the caller can abort startup. */
export async function connectMongo(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URI);
  logger.info("MongoDB connected");

  mongoose.connection.on("error", (err) => logger.error("MongoDB error:", err));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
}
