import { api } from "./client";
import type { Message } from "../types";

/** Searches text messages across the user's conversations. */
export async function searchMessages(query: string): Promise<Message[]> {
  const { data } = await api.get<{ results: Message[] }>("/search", {
    params: { q: query },
  });
  return data.results;
}
