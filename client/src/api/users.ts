import { api } from "./client";
import type { Participant } from "../types";

/** All users except the current one — candidates to start a chat with. */
export async function listUsers(): Promise<Participant[]> {
  const { data } = await api.get<{ users: Participant[] }>("/users");
  return data.users;
}
