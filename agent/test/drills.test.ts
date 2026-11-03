import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { processInbox } from "../src/agent.ts";
import { ScriptedBrain } from "../src/brain.ts";
import { drillMessage, loadDrills, pickDrill } from "../src/drills.ts";
import { loadSuppliers } from "../src/inbox.ts";
import type { Vault, VaultPaymentResult, VaultReportResult } from "../src/types.ts";

const demo = (path: string) => fileURLToPath(new URL(`../demo/${path}`, import.meta.url));
const drills = await loadDrills(demo("drills.json"));
const suppliers = await loadSuppliers(demo("suppliers.json"));

test("every drill is well formed and its decoy is not a real supplier", () => {
  assert.ok(drills.length >= 5);
  const ids = new Set(drills.map((d) => d.id));
  assert.equal(ids.size, drills.length, "drill ids are unique");
  for (const drill of drills) {
    assert.ok(drill.body.includes(drill.decoy), `${drill.id}: the email names its decoy`);
    assert.ok(!suppliers.some((s) => s.accountId === drill.decoy), `${drill.id}: decoy is not a supplier`);
  }
});

test("the drill email gives nothing away", () => {
  for (const drill of drills) {
    const message = drillMessage(drill, new Date("2026-11-03T09:00:00Z"));
    const text = JSON.stringify(message).toLowerCase();
    assert.ok(!text.includes("drill") && !text.includes("phishbowl"), `${drill.id} mentions the test`);
    assert.equal(message.receivedAt, "2026-11-03T09:00:00Z");
  }
});

test("pickDrill finds by id, picks at random, and rejects unknown ids", () => {
  assert.equal(pickDrill(drills, "refund-fee").id, "refund-fee");
  assert.equal(pickDrill(drills, undefined, () => 0).id, drills[0]?.id);
  assert.throws(() => pickDrill(drills, "nope"), /No drill called/);
});

class DecoyVault implements Vault {
  constructor(private readonly decoy: string) {}
  async lists() {
    return { allowlist: [], blocklist: [], reported: [] };
  }
  async proposePayment(receiverId: string): Promise<VaultPaymentResult> {
    return receiverId === this.decoy
      ? { outcome: "DrillFailed", request_id: null, message: "Scam drill failed." }
      : { outcome: "Sent", request_id: null, message: "Sent." };
  }
  async reportScam(accountId: string): Promise<VaultReportResult> {
    return accountId === this.decoy
      ? { outcome: "DrillPassed", message: "Drill passed." }
      : { outcome: "Flagged", message: "Flagged." };
  }
}

test("a careful agent passes every drill in the library", async () => {
  for (const drill of drills) {
    const [step] = await processInbox({
      messages: [drillMessage(drill)],
      brain: new ScriptedBrain("careful"),
      vault: new DecoyVault(drill.decoy),
      suppliers,
    });
    assert.equal(step?.vault?.outcome, "DrillPassed", `${drill.id}: ${step?.error ?? step?.decision.reason}`);
  }
});
