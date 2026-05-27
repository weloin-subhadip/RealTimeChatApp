import type { Request, Response } from "express";
import { searchMessages } from "../services/message.service.js";

/** GET /api/search?q=... — message search across the user's conversations. */
export async function search(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) {
    res.json({ results: [] });
    return;
  }
  const results = await searchMessages(req.userId!, q);
  res.json({ results });
}
