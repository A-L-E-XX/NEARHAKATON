import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDecision, parseToolCall } from "../src/decision.ts";
import type { AgentContext, InboxMessage } from "../src/types.ts";

const context: AgentContext = {
  suppliers: [{ name: "Golden Mill Flour", accountId: "goldenmill-pb.testnet", sells: "flour" }],
  blocked: [],
};

const invoice: InboxMessage = {
  id: "m-1",
  from: "Golden Mill Flour <accounts@goldenmill-pb.testnet>",
  receivedAt: "2026-11-03T08:05:00Z",
  subject: "Invoice GM-1042",
  body: "Amount due: 0.40 NEAR\nPay to: goldenmill-pb.testnet",
};

test("a valid pay_invoice call becomes a payment decision", () => {
  const decision = parseToolCall(
    "pay_invoice",
    '{"receiver_id":"goldenmill-pb.testnet","amount_near":"0.4","invoice_number":"GM-1042","reason":"Known supplier"}',
  );
  assert.deepEqual(decision, {
    action: "pay",
    receiverId: "goldenmill-pb.testnet",
    amountNear: "0.4",
    invoiceNumber: "GM-1042",
    reason: "Known supplier",
  });
});

test("amounts sent as numbers are accepted", () => {
  const decision = parseToolCall("pay_invoice", { receiver_id: "goldenmill-pb.testnet", amount_near: 0.4, reason: "ok" });
  assert.equal(decision.action === "pay" && decision.amountNear, "0.4");
});

test("bad tool arguments are refused", () => {
  assert.throws(() => parseToolCall("pay_invoice", { receiver_id: "Not An Account", amount_near: "1", reason: "x" }));
  assert.throws(() => parseToolCall("pay_invoice", { receiver_id: "a.testnet", amount_near: "0.4 NEAR", reason: "x" }));
  assert.throws(() => parseToolCall("pay_invoice", { receiver_id: "a.testnet", amount_near: "0", reason: "x" }));
  assert.throws(() => parseToolCall("pay_invoice", { receiver_id: "a.testnet", amount_near: "5000", reason: "x" }));
  assert.throws(() => parseToolCall("pay_invoice", "not json"));
  assert.throws(() => parseToolCall("transfer_everything", {}));
});

test("the model cannot pay an account it made up", () => {
  const decision = checkDecision(
    { action: "pay", receiverId: "attacker.testnet", amountNear: "0.4", reason: "trust me" },
    invoice,
    context,
  );
  assert.equal(decision.action, "skip");
});

test("the model cannot pay an amount that is not in the message", () => {
  const decision = checkDecision(
    { action: "pay", receiverId: "goldenmill-pb.testnet", amountNear: "40", reason: "typo" },
    invoice,
    context,
  );
  assert.equal(decision.action, "skip");
});

test("a real invoice from a known supplier passes the checks", () => {
  const decision = checkDecision(
    { action: "pay", receiverId: "goldenmill-pb.testnet", amountNear: "0.4", reason: "Known supplier" },
    invoice,
    context,
  );
  assert.equal(decision.action, "pay");
});

test("the model cannot report an account that is not in the message", () => {
  const decision = checkDecision({ action: "report", accountId: "innocent.testnet", reason: "?" }, invoice, context);
  assert.equal(decision.action, "skip");
});
