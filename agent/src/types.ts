/** One message in the bakery's inbox: an invoice, a question, or a scam. */
export interface InboxMessage {
  id: string;
  from: string;
  receivedAt: string;
  subject: string;
  body: string;
}

/** A supplier the bakery already buys from, and the only account it pays them on. */
export interface Supplier {
  name: string;
  accountId: string;
  sells: string;
}

export type Decision =
  | {
      action: "pay";
      receiverId: string;
      amountNear: string;
      invoiceNumber?: string;
      reason: string;
    }
  | { action: "report"; accountId: string; reason: string }
  | { action: "skip"; reason: string };

export interface BrainAnswer {
  decision: Decision;
  model: string;
  /** NEAR AI Cloud chat id. Its TEE signature can be fetched from /v1/signature/{id}. */
  inferenceId?: string;
}

export interface AgentContext {
  suppliers: Supplier[];
  blocked: string[];
}

/** The AI part. It only decides; it never touches money. */
export interface Brain {
  readonly model: string;
  decide(message: InboxMessage, context: AgentContext): Promise<BrainAnswer>;
}

export type PaymentOutcome = "Sent" | "Held" | "Blocked" | "DrillFailed" | "DryRun";
export type ReportOutcome = "DrillPassed" | "Flagged" | "AlreadyKnown" | "DryRun";

export interface VaultPaymentResult {
  outcome: PaymentOutcome;
  request_id?: number | null;
  message: string;
}

export interface VaultReportResult {
  outcome: ReportOutcome;
  message: string;
}

export interface VaultLists {
  allowlist: string[];
  blocklist: string[];
  reported: string[];
}

/** The money part. The Phishbowl vault contract decides what actually happens. */
export interface Vault {
  lists(): Promise<VaultLists>;
  proposePayment(receiverId: string, amountYocto: string, memo: string): Promise<VaultPaymentResult>;
  reportScam(accountId: string, note: string): Promise<VaultReportResult>;
}

export interface StepResult {
  messageId: string;
  subject: string;
  model: string;
  inferenceId?: string;
  decision: Decision;
  vault?: { outcome: string; message: string };
  error?: string;
}
