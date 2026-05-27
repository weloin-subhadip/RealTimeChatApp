import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import searchRoutes from "./routes/search.routes.js";
import { UPLOAD_DIR } from "./middleware/upload.js";

/**
 * Builds the Express application (REST layer only). The HTTP server and
 * Socket.IO are wired up separately in server.ts so this stays focused.
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Serve uploaded media. Filenames are random UUIDs, so URLs are unguessable;
  // a stricter setup would gate this behind auth.
  app.use("/uploads", express.static(UPLOAD_DIR));

  // Health check — used to confirm the server + its deps are up.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/search", searchRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
