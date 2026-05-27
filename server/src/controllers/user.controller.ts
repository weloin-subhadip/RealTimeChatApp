import type { Request, Response } from "express";
import { User } from "../models/user.model.js";

/** Lists all users except the requester — used to start new conversations. */
export async function listUsers(req: Request, res: Response) {
  const users = await User.find({ _id: { $ne: req.userId } })
    .select("name email avatarUrl status")
    .sort({ name: 1 });

  res.json({
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl ?? undefined,
      status: u.status,
    })),
  });
}
