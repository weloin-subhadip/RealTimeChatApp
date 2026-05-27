import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "./errorHandler.js";

/** Directory (relative to the server's cwd) where uploads are stored. */
export const UPLOAD_DIR = "uploads";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// Images, PDFs, and audio (voice notes) only.
function isAllowed(mime: string): boolean {
  return (
    mime.startsWith("image/") ||
    mime.startsWith("audio/") ||
    mime === "application/pdf"
  );
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  // Store under a random name to avoid collisions and path tricks; keep the
  // original extension for correct content-type on download.
  filename: (_req, file, cb) =>
    cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowed(file.mimetype)) cb(null, true);
    else cb(new AppError(400, `Unsupported file type: ${file.mimetype}`));
  },
});
