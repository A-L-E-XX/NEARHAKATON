import { checkDecision } from "./decision.ts";
import { nearToYocto } from "./money.ts";
import type {
  AgentContext,
  Brain,
  BrainAnswer,
  Decision,
  InboxMessage,
  StepResult,
  Supplier,
  Vault,
} from "./types.ts";

/** The vault contract refuses memos and notes longer than 280 bytes. */
export const MAX_TEXT_BYTES = 280;

export interface ProcessOptions {
  messages: InboxMessage[];
  brain: Brain;
  vault: Vault;
  suppliers: Supplier[];
  onStep?: (step: StepResult) => void;
}

/** Read every message, let the brain decide, check the decision, and hand it to the vault. */
export async function processInbox(options: ProcessOptions): Promise<StepResult[]> {
  const { messages, brain, vault, suppliers, onStep } = options;
  const lists = await vault.lists();
  const context: AgentContext = { suppliers, blocked: lists.blocklist };
  const results: StepResult[] = [];
  for (const message of messages) {
    const step = await handleMessage(message, brain, vault, context);
    results.push(step);
    onStep?.(step);
  }
  return results;
}

async function handleMessage(
  message: InboxMessage,
  brain: Brain,
  vault: Vault,
  context: AgentContext,
): Promise<StepResult> {
  const base = { messageId: message.id, subject: message.subject, model: brain.model };

  let answer: BrainAnswer;
  try {
    answer = await brain.decide(message, context);
  } catch (error) {
    return { ...base, decision: { action: "skip", reason: "The model call failed." }, error: errorText(error) };
  }

  const decision = checkDecision(answer.decision, message, context);
  const step: StepResult = { ...base, inferenceId: answer.inferenceId, decision };
  try {
    if (decision.action === "pay") {
      const result = await vault.proposePayment(
        decision.receiverId,
        nearToYocto(decision.amountNear),
        memoFor(decision, answer.inferenceId),
      );
      step.vault = { outcome: result.outcome, message: result.message };
    } else if (decision.action === "report") {
      const result = await vault.reportScam(decision.accountId, truncateBytes(decision.reason, MAX_TEXT_BYTES));
      step.vault = { outcome: result.outcome, message: result.message };
    }
  } catch (error) {
    step.error = errorText(error);
  }
  return step;
}

/** "Invoice GM-1042: reason | ai:<chat id>", always within the vault's 280-byte limit. */
export function memoFor(decision: Extract<Decision, { action: "pay" }>, inferenceId?: string): string {
  const suffix = inferenceId ? ` | ai:${inferenceId}` : "";
  const head = `${decision.invoiceNumber ? `Invoice ${decision.invoiceNumber}` : "Invoice"}: ${decision.reason}`;
  return truncateBytes(head, MAX_TEXT_BYTES - byteLength(suffix)) + suffix;
}

export function truncateBytes(text: string, maxBytes: number): string {
  let out = text;
  while (byteLength(out) > maxBytes) {
    out = out.slice(0, -1);
  }
  return out;
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/\s+/g, " ").slice(0, 300);
}
