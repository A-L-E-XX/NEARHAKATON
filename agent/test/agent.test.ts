import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { MAX_TEXT_BYTES, memoFor, processInbox } from "../src/agent.ts";
import { NearAiBrain, ScriptedBrain } from "../src/brain.ts";
import { loadInbox, loadSuppliers } from "../src/inbox.ts";
import type { Brain, InboxMessage, StepResult, Vault, VaultPaymentResult, VaultReportResult } from "../src/types.ts";

const demo = (path: string) => fileURLToPath(new URL(`../demo/${path}`, import.meta.url));
const messages = await loadInbox(demo("inbox"));
const suppliers = await loadSuppliers(demo("suppliers.json"));
const DECOY = "goldenmill-billing.testnet";

/** Stands in for the vault contract: the decoy is a scam drill, everything else goes through. */
class FakeVault implements Vault {
  calls: string[] = [];

  async lists() {
    return { allowlist: [], blocklist: [], reported: [] };
  }

  async proposePayment(receiverId: string, amountYocto: string): Promise<VaultPaymentResult> {
    this.calls.push(`pay ${receiverId} ${amountYocto}`);
    if (receiverId === DECOY) {
      return { outcome: "DrillFailed", request_id: null, message: "Scam drill failed. Nothing was sent." };
    }
    return { outcome: "Sent", request_id: null, message: `Sent to ${receiverId}.` };
  }

  async reportScam(accountId: string): Promise<VaultReportResult> {
    this.calls.push(`report ${accountId}`);
    return accountId === DECOY
      ? { outcome: "DrillPassed", message: "Scam drill passed." }
      : { outcome: "Flagged", message: "Reported." };
  }
}

const outcomeOf = (results: StepResult[], id: string) => results.find((r) => r.messageId === id)?.vault?.outcome;

test("the demo inbox loads", () => {
  assert.equal(messages.length, 5);
  assert.equal(suppliers.length, 3);
});

test("a naive agent falls for the fake 'account changed' email and the vault stops it", async () => {
  const vault = new FakeVault();
  const results = await processInbox({ messages, brain: new ScriptedBrain("naive"), vault, suppliers });
  assert.equal(outcomeOf(results, "m-001"), "Sent");
  assert.equal(outcomeOf(results, "m-005"), "DrillFailed");
  assert.equal(results.find((r) => r.messageId === "m-003")?.decision.action, "skip");
});

test("a careful agent pays the real invoices and reports the scam", async () => {
  const vault = new FakeVault();
  const results = await processInbox({ messages, brain: new ScriptedBrain("careful"), vault, suppliers });
  assert.equal(outcomeOf(results, "m-001"), "Sent");
  assert.equal(outcomeOf(results, "m-002"), "Sent");
  assert.equal(outcomeOf(results, "m-004"), "Sent");
  assert.equal(outcomeOf(results, "m-005"), "DrillPassed");
  assert.ok(!vault.calls.some((call) => call.startsWith(`pay ${DECOY}`)));
});

test("a model that invents an account never reaches the vault", async () => {
  const liar: Brain = {
    model: "liar",
    decide: async () => ({
      model: "liar",
      decision: { action: "pay", receiverId: "attacker.testnet", amountNear: "0.4", reason: "trust me" },
    }),
  };
  const vault = new FakeVault();
  const results = await processInbox({ messages: messages.slice(0, 1), brain: liar, vault, suppliers });
  assert.equal(results[0]?.decision.action, "skip");
  assert.deepEqual(vault.calls, []);
});

test("a model error is recorded and the agent moves on", async () => {
  let calls = 0;
  const flaky: Brain = {
    model: "flaky",
    decide: async (message: InboxMessage) => {
      calls += 1;
      if (calls === 1) throw new Error("timeout");
      return { model: "flaky", decision: { action: "skip", reason: `read ${message.id}` } };
    },
  };
  const results = await processInbox({ messages: messages.slice(0, 2), brain: flaky, vault: new FakeVault(), suppliers });
  assert.equal(results[0]?.error, "timeout");
  assert.equal(results[1]?.decision.action, "skip");
});

function fakeNearAi(body: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

test("the NEAR AI Cloud brain reads a tool call and keeps the inference id", async () => {
  const brain = new NearAiBrain({
    apiKey: "test",
    model: "test-model",
    fetchImpl: fakeNearAi({
      id: "chatcmpl-123",
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: "report_scam",
                  arguments: JSON.stringify({ account_id: DECOY, reason: "Changed bank details" }),
                },
              },
            ],
          },
        },
      ],
    }),
  });
  const answer = await brain.decide(messages[4]!, { suppliers, blocked: [] });
  assert.deepEqual(answer.decision, { action: "report", accountId: DECOY, reason: "Changed bank details" });
  assert.equal(answer.inferenceId, "chatcmpl-123");
});

test("the NEAR AI Cloud brain also understands a tool call written as text", async () => {
  const brain = new NearAiBrain({
    apiKey: "test",
    model: "test-model",
    fetchImpl: fakeNearAi({
      choices: [{ message: { content: '{"name":"skip_message","arguments":{"reason":"Not an invoice"}}' } }],
    }),
  });
  const answer = await brain.decide(messages[2]!, { suppliers, blocked: [] });
  assert.deepEqual(answer.decision, { action: "skip", reason: "Not an invoice" });
});

test("an error from NEAR AI Cloud is reported, not ignored", async () => {
  const brain = new NearAiBrain({ apiKey: "bad", model: "m", fetchImpl: fakeNearAi({ error: "unauthorized" }, 401) });
  await assert.rejects(brain.decide(messages[0]!, { suppliers, blocked: [] }), /401/);
});

test("payment memos keep the inference id and fit the vault's limit", () => {
  const memo = memoFor(
    { action: "pay", receiverId: "goldenmill-pb.testnet", amountNear: "0.4", invoiceNumber: "GM-1042", reason: "x".repeat(400) },
    "chatcmpl-123",
  );
  assert.ok(Buffer.byteLength(memo) <= MAX_TEXT_BYTES);
  assert.ok(memo.endsWith("| ai:chatcmpl-123"));
  assert.ok(memo.startsWith("Invoice GM-1042: "));
});
