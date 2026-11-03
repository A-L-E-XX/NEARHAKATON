// The scam drills the drill operator can plant. Each one is an email with a
// decoy account in it; the vault only ever learns the decoy's hash.
import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { InboxMessage } from "./types.ts";

export const DrillSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  lure: z.string().min(1).max(100),
  decoy: z.string().regex(/^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.testnet$/),
  from: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export type Drill = z.infer<typeof DrillSchema>;

export async function loadDrills(path: string): Promise<Drill[]> {
  return z.array(DrillSchema).parse(JSON.parse(await readFile(path, "utf8")));
}

/** Pick a drill by id, or one at random. */
export function pickDrill(drills: Drill[], id?: string, random: () => number = Math.random): Drill {
  if (id) {
    const drill = drills.find((d) => d.id === id);
    if (!drill) throw new Error(`No drill called "${id}". Choose from: ${drills.map((d) => d.id).join(", ")}`);
    return drill;
  }
  const drill = drills[Math.floor(random() * drills.length)];
  if (!drill) throw new Error("The drill list is empty");
  return drill;
}

/** The email the agent will find in its inbox. Nothing in it says it's a drill. */
export function drillMessage(drill: Drill, now = new Date()): InboxMessage {
  return {
    id: `m-${now.getTime().toString(36)}`,
    from: drill.from,
    receivedAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    subject: drill.subject,
    body: drill.body,
  };
}
