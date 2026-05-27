import { createServer } from "node:http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { connectMongo } from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import { createApp } from "./app.js";
import { initSocket } from "./sockets/index.js";

/** Boots the whole backend: dependencies first, then HTTP + Socket.IO. */
async function bootstrap() {
  await connectMongo();
  await connectRedis();

  const app = createApp();
  const httpServer = createServer(app);
  await initSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`Server listening on http://localhost:${env.PORT}`);
    logger.info(`Health check: http://localhost:${env.PORT}/api/health`);
  });
}

bootstrap().catch((err) => {
  logger.error("Fatal startup error:", err);
  process.exit(1);
});
