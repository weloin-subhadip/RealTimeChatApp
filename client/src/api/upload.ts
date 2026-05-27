import { api } from "./client";
import type { MediaInfo, MessageType } from "../types";

/** Uploads a file and returns its server metadata (url, filename, mime, size). */
export async function uploadFile(file: File | Blob, filename: string): Promise<MediaInfo> {
  const form = new FormData();
  form.append("file", file, filename);
  // Let the browser set the multipart boundary; don't override Content-Type.
  const { data } = await api.post<MediaInfo>("/upload", form);
  return data;
}

/** Maps a MIME type to our message type. */
export function mediaTypeFromMime(mime: string): Exclude<MessageType, "text"> {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "voice";
  return "pdf";
}
