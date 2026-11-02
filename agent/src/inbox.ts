import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { InboxMessage, Supplier } from "./types.ts";

const MessageSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  receivedAt: z.string().min(1),
  subject: z.string(),
  body: z.string(),
});

const SupplierSchema = z.object({
  name: z.string().min(1),
  accountId: z.string().min(2),
  sells: z.string().min(1),
});

/** Load messages from a folder of JSON files (read in file-name order) or from one JSON array. */
export async function loadInbox(path: string): Promise<InboxMessage[]> {
  if ((await stat(path)).isDirectory()) {
    const files = (await readdir(path)).filter((name) => name.endsWith(".json")).sort();
    const messages: InboxMessage[] = [];
    for (const file of files) {
      messages.push(MessageSchema.parse(JSON.parse(await readFile(join(path, file), "utf8"))));
    }
    return messages;
  }
  return z.array(MessageSchema).parse(JSON.parse(await readFile(path, "utf8")));
}

export async function loadSuppliers(path: string): Promise<Supplier[]> {
  return z.array(SupplierSchema).parse(JSON.parse(await readFile(path, "utf8")));
}
