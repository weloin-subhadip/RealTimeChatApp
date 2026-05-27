import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger.js";

/** A typed application error carrying an HTTP status code. */
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}

/** 404 handler for unmatched routes. */
export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
}

/** Central error handler. Express recognizes it by its 4 arguments. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  // Multer rejections (e.g. file too large) — surface as 400, not 500.
  if (err && typeof err === "object" && (err as { name?: string }).name === "MulterError") {
    return res.status(400).json({ error: (err as Error).message });
  }
  logger.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
}
