import { z } from "zod";
import { amountsIn, nearToYocto } from "./money.ts";
import type { AgentContext, Decision, InboxMessage } from "./types.ts";

/** NEAR account id rules: 2-64 characters, lowercase letters, digits, - and _ separated by dots. */
const ACCOUNT_ID = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
/** The agent never asks for more than this in one payment. The vault's own limits are lower. */
export const MAX_NEAR_PER_PAYMENT = 100;

const MAX_YOCTO = BigInt(nearToYocto(String(MAX_NEAR_PER_PAYMENT)));

/** yoctoNEAR as a bigint, or -1 if the text is not an amount. */
function yoctoOrMinusOne(value: string): bigint {
  try {
    return BigInt(nearToYocto(value));
  } catch {
    return -1n;
  }
}

const accountId = z.string().trim().regex(ACCOUNT_ID, "is not a valid NEAR account id");
const amount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,24})?$/, "must be a plain number like 0.25")
  .refine((value) => yoctoOrMinusOne(value) > 0n, "must be more than zero")
  .refine((value) => yoctoOrMinusOne(value) <= MAX_YOCTO, `must be at most ${MAX_NEAR_PER_PAYMENT} NEAR`);
const reason = z.string().trim().min(1).max(300);

export const PayArgs = z.object({
  receiver_id: accountId,
  amount_near: z.union([amount, z.number().transform(String).pipe(amount)]),
  invoice_number: z.string().trim().max(64).optional(),
  reason,
});
export const ReportArgs = z.object({ account_id: accountId, reason });
export const SkipArgs = z.object({ reason });

/** The three tools the model can call, in OpenAI function-calling format. */
export const TOOLS = [
  {
    type: "function",
    function: {
      name: "pay_invoice",
      description:
        "Ask the vault to pay a genuine invoice from a known supplier. The vault may still hold or block it.",
      parameters: {
        type: "object",
        properties: {
          receiver_id: { type: "string", description: "The NEAR account to pay, exactly as written." },
          amount_near: { type: "string", description: 'Amount in NEAR, for example "0.4".' },
          invoice_number: { type: "string", description: "The invoice number, if there is one." },
          reason: { type: "string", description: "One sentence on why this invoice is genuine." },
        },
        required: ["receiver_id", "amount_near", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_scam",
      description: "Report the account in a message that is trying to trick the bakery into paying it.",
      parameters: {
        type: "object",
        properties: {
          account_id: { type: "string", description: "The NEAR account the scam wants money sent to." },
          reason: { type: "string", description: "One sentence on what gave the scam away." },
        },
        required: ["account_id", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "skip_message",
      description: "Do nothing with this message: it is not an invoice, or you are not sure.",
      parameters: {
        type: "object",
        properties: { reason: { type: "string", description: "One sentence on why." } },
        required: ["reason"],
      },
    },
  },
] as const;

/** Turn a raw tool call from the model into a checked Decision. Throws if the arguments are invalid. */
export function parseToolCall(name: string, rawArguments: string | Record<string, unknown>): Decision {
  const args = typeof rawArguments === "string" ? parseJson(rawArguments) : rawArguments;
  switch (name) {
    case "pay_invoice": {
      const parsed = PayArgs.parse(args);
      return {
        action: "pay",
        receiverId: parsed.receiver_id,
        amountNear: parsed.amount_near,
        invoiceNumber: parsed.invoice_number,
        reason: parsed.reason,
      };
    }
    case "report_scam": {
      const parsed = ReportArgs.parse(args);
      return { action: "report", accountId: parsed.account_id, reason: parsed.reason };
    }
    case "skip_message":
      return { action: "skip", reason: SkipArgs.parse(args).reason };
    default:
      throw new Error(`Unknown tool "${name}"`);
  }
}

/**
 * Deterministic checks between the model and the vault. They stop the model
 * from inventing accounts or amounts. They do not judge whether a message is
 * a scam: that is the model's job, and catching its mistakes is the vault's.
 */
export function checkDecision(decision: Decision, message: InboxMessage, context: AgentContext): Decision {
  const text = `${message.from}\n${message.subject}\n${message.body}`;
  if (decision.action === "pay") {
    const known = context.suppliers.some((s) => s.accountId === decision.receiverId);
    if (!known && !text.includes(decision.receiverId)) {
      return refuse(`the model chose ${decision.receiverId}, which is not a known supplier and is not in the message`);
    }
    if (!amountsIn(text).has(nearToYocto(decision.amountNear))) {
      return refuse(`the model chose ${decision.amountNear} NEAR, which does not appear in the message`);
    }
  }
  if (decision.action === "report" && !text.includes(decision.accountId)) {
    return refuse(`the model reported ${decision.accountId}, which is not in the message`);
  }
  return decision;
}

function refuse(why: string): Decision {
  return { action: "skip", reason: `Refused before reaching the vault: ${why}.` };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Tool arguments are not valid JSON: ${raw.slice(0, 200)}`);
  }
}
