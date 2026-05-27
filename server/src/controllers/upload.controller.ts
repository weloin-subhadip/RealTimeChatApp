import type { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";

/**
 * Returns metadata for an uploaded file. The client then sends a media message
 * (message:send with type + this media) over the socket. Duration for voice
 * notes is measured client-side and added when the message is sent.
 */
export function uploadFile(req: Request, res: Response) {
  if (!req.file) throw new AppError(400, "No file uploaded");
  res.status(201).json({
    url: `/uploads/${req.file.filename}`,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
}
