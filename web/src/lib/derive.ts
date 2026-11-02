// Everything here is computed from what the vault contract returns, using
// fixed, explainable rules. Nothing is guessed or generated.
import type { AccessKey } from "./near";
import type { Activity, ActivityKind, Status, VaultData } from "./vault";

export type Tone = "secure" | "caution" | "danger" | "ice" | "neutral" | "brand";
export type Severity = "critical" | "high" | "medium" | "low";

export interface VaultSnapshot {
  id: string;
  data?: VaultData;
  error?: string;
  updatedAt?: number;
}

export const KIND: Record<ActivityKind, { label: string; tone: Tone }> = {
  Sent: { label: "Paid", tone: "secure" },
  Held: { label: "Held for owner", tone: "caution" },
  Approved: { label: "Approved", tone: "secure" },
  Rejected: { label: "Rejected", tone: "caution" },
  Blocked: { label: "Blocked", tone: "danger" },
  DrillPassed: { label: "Drill passed", tone: "secure" },
  DrillFailed: { label: "Drill failed", tone: "danger" },
  DrillMissed: { label: "Drill missed", tone: "caution" },
  ScamReported: { label: "Reported by agent", tone: "caution" },
  ReportDismissed: { label: "False alarm", tone: "neutral" },
  Frozen: { label: "Frozen", tone: "ice" },
  Unfrozen: { label: "Unfrozen", tone: "neutral" },
  TransferFailed: { label: "Transfer failed", tone: "danger" },
  SettingsChanged: { label: "Settings changed", tone: "neutral" },
  Withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "caution",
  low: "neutral",
};

/** The rules behind every severity label, shown to users so nothing is a black box. */
export const SEVERITY_RULES: Array<{ severity: Severity; rule: string }> = [
  { severity: "critical", rule: "The agent tried to pay a scam-drill decoy." },
  {
    severity: "high",
    rule: "The agent tried to pay a blocked account, the vault froze itself after too many requests, or the agent's account has a full-access key.",
  },
  { severity: "medium", rule: "The agent flagged an account as a scam, or a payment was held for breaking a limit." },
  { severity: "low", rule: "A drill ran out without a report, or the owner marked a report as a false alarm." },
];

export type Actor = "Agent" | "Owner" | "Vault" | "Drill runner" | "NEAR";

export function actorOf(entry: Activity): Actor {
  switch (entry.kind) {
    case "Sent":
    case "Held":
    case "Blocked":
    case "DrillFailed":
    case "DrillPassed":
    case "ScamReported":
      return "Agent";
    case "Approved":
    case "Rejected":
    case "Unfrozen":
    case "SettingsChanged":
    case "Withdrawn":
    case "ReportDismissed":
      return "Owner";
    case "DrillMissed":
      return "Drill runner";
    case "TransferFailed":
      return "NEAR";
    case "Frozen":
      if (/by the owner/i.test(entry.message)) return "Owner";
      if (/by the agent/i.test(entry.message)) return "Agent";
      return "Vault";
  }
}

export function severityOf(entry: Activity): Severity | null {
  switch (entry.kind) {
    case "DrillFailed":
      return "critical";
    case "Blocked":
      return "high";
    case "Frozen":
      return actorOf(entry) === "Vault" ? "high" : null;
    case "ScamReported":
    case "Held":
      return "medium";
    case "DrillMissed":
    case "ReportDismissed":
      return "low";
    default:
      return null;
  }
}

// ------------------------------------------------------------------ threats

export interface Threat {
  key: string;
  vaultId: string;
  agentId: string;
  at: number | null;
  severity: Severity;
  category: string;
  title: string;
  explanation: string;
  recommended: string;
  account: string | null;
  kind: ActivityKind | "FullAccessKey";
}

const THREAT_TEXT: Partial<Record<ActivityKind, { category: string; title: string; recommended: string }>> = {
  DrillFailed: {
    category: "Phishing (scam drill)",
    title: "Agent tried to pay a scam decoy",
    recommended:
      "Keep the vault frozen, look at what the agent read, and tighten its instructions before unfreezing. Its limits have already dropped.",
  },
  Blocked: {
    category: "Known scam address",
    title: "Payment to a blocked account refused",
    recommended: "Nothing was sent. Check why the agent tried to pay an account you had already blocked.",
  },
  ScamReported: {
    category: "Suspicious address",
    title: "Agent flagged an account as a scam",
    recommended: "Review the account. Confirm it to block it for good, or dismiss it if it is legitimate.",
  },
  Frozen: {
    category: "Unusual transaction frequency",
    title: "Vault froze itself after too many requests",
    recommended: "Look for a loop or an attack in the activity log before unfreezing.",
  },
  DrillMissed: {
    category: "Phishing not reported (scam drill)",
    title: "Agent ignored a fake scam",
    recommended: "The agent didn't pay, but it didn't flag the message either. Consider tightening its instructions.",
  },
  ReportDismissed: {
    category: "False alarm",
    title: "Owner dismissed a report",
    recommended: "No action needed. False alarms cost the agent 3 points.",
  },
};

export function threatsFor(vaultId: string, data: VaultData): Threat[] {
  const threats: Threat[] = [];
  if (data.agentKeys?.some((key) => key.kind === "full")) {
    threats.push({
      key: `${vaultId}:full-key`,
      vaultId,
      agentId: data.status.agent_id,
      at: null,
      severity: "high",
      category: "Over-powered agent key",
      title: "The agent's account has a full-access key",
      explanation:
        "Whoever holds a full-access key can move that account's NEAR, add keys and call any contract. If the agent is hijacked while it holds one, the attacker gets all of that. An agent only needs a function-call key limited to the vault.",
      recommended:
        "Give the agent a function-call key for propose_payment, report_scam and freeze only, then delete the full-access key from the agent's account.",
      account: data.status.agent_id,
      kind: "FullAccessKey",
    });
  }
  for (const entry of data.activity) {
    const severity = severityOf(entry);
    const text = THREAT_TEXT[entry.kind];
    if (!severity || !text || entry.kind === "Held") continue;
    threats.push({
      key: `${vaultId}:${entry.id}`,
      vaultId,
      agentId: data.status.agent_id,
      at: entry.at_ms,
      severity,
      category: text.category,
      title: text.title,
      explanation: entry.message,
      recommended: text.recommended,
      account: entry.receiver_id,
      kind: entry.kind,
    });
  }
  return threats;
}

// ------------------------------------------------------------- transactions

export type TxState = "Pending" | "Completed" | "Approved" | "Rejected" | "Blocked" | "Failed";

export interface Tx {
  key: string;
  vaultId: string;
  agentId: string;
  eventId: number;
  state: TxState;
  kind: ActivityKind;
  to: string | null;
  amount: string | null;
  at: number;
  risk: Severity | null;
  decision: string;
  message: string;
  pendingId?: number;
  reasons?: string[];
  memo?: string | null;
}

const TX_STATE: Partial<Record<ActivityKind, TxState>> = {
  Sent: "Completed",
  Approved: "Approved",
  Rejected: "Rejected",
  Blocked: "Blocked",
  DrillFailed: "Blocked",
  TransferFailed: "Failed",
};

const DECISION: Partial<Record<ActivityKind, string>> = {
  Sent: "Sent automatically: within the agent's limits",
  Approved: "Approved by the owner",
  Rejected: "Rejected by the owner",
  Blocked: "Blocked: the account is on the blocklist",
  DrillFailed: "Blocked: the account is a scam-drill decoy",
  TransferFailed: "Failed on NEAR: the money stayed in the vault",
};

export function transactionsFor(vaultId: string, data: VaultData): Tx[] {
  const txs: Tx[] = data.pending.map((payment) => ({
    key: `${vaultId}:pending:${payment.id}`,
    vaultId,
    agentId: data.status.agent_id,
    eventId: payment.id,
    state: "Pending" as const,
    kind: "Held" as const,
    to: payment.receiver_id,
    amount: payment.amount,
    at: payment.created_at_ms,
    risk: "medium" as const,
    decision: `Waiting for the owner: ${payment.reasons.join("; ")}`,
    message: payment.memo ?? "",
    pendingId: payment.id,
    reasons: payment.reasons,
    memo: payment.memo,
  }));
  for (const entry of data.activity) {
    const state = TX_STATE[entry.kind];
    if (!state) continue;
    txs.push({
      key: `${vaultId}:${entry.id}`,
      vaultId,
      agentId: data.status.agent_id,
      eventId: entry.id,
      state,
      kind: entry.kind,
      to: entry.receiver_id,
      amount: entry.amount,
      at: entry.at_ms,
      risk: entry.kind === "DrillFailed" ? "critical" : entry.kind === "Blocked" ? "high" : null,
      decision: DECISION[entry.kind] ?? "",
      message: entry.message,
    });
  }
  return txs.sort((a, b) => b.at - a.at);
}

// ------------------------------------------------------------------ charts

const DAY = 86_400_000;

export interface DayBucket {
  day: string;
  sent: number;
  held: number;
  blocked: number;
}

/** Payment events per day for the last `days` days, from the vault's activity log. */
export function dailyActivity(entries: Activity[], days = 14): DayBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.getTime() - (days - 1) * DAY;
  const buckets: DayBucket[] = Array.from({ length: days }, (_, i) => ({
    day: new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(start + i * DAY)),
    sent: 0,
    held: 0,
    blocked: 0,
  }));
  for (const entry of entries) {
    const index = Math.floor((entry.at_ms - start) / DAY);
    const bucket = buckets[index];
    if (!bucket) continue;
    if (entry.kind === "Sent" || entry.kind === "Approved") bucket.sent += 1;
    else if (entry.kind === "Held") bucket.held += 1;
    else if (entry.kind === "Blocked" || entry.kind === "DrillFailed") bucket.blocked += 1;
  }
  return buckets;
}

export function severityCounts(snapshots: VaultSnapshot[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const snapshot of snapshots) {
    if (!snapshot.data) continue;
    for (const entry of snapshot.data.activity) {
      const severity = severityOf(entry);
      if (severity) counts[severity] += 1;
    }
    if (snapshot.data.agentKeys?.some((key) => key.kind === "full")) counts.high += 1;
  }
  return counts;
}

// ------------------------------------------------------------ agent status

export function agentState(status: Status): { label: string; tone: Tone; why: string } {
  if (status.frozen) {
    return { label: "Suspended", tone: "ice", why: "The vault is frozen. Nothing can be sent until the owner unfreezes it." };
  }
  if (status.pending_count > 0) {
    return {
      label: "Pending approval",
      tone: "caution",
      why: `${status.pending_count} payment${status.pending_count === 1 ? " is" : "s are"} waiting for the owner.`,
    };
  }
  if (status.tier === "Probation") {
    return { label: "Restricted", tone: "caution", why: "Score below 20: every payment needs the owner's approval." };
  }
  return { label: "Active", tone: "secure", why: "Payments within its limits go through on their own." };
}

export function keyCheck(vaultId: string, keys: AccessKey[] | null): { tone: Tone; label: string; detail: string } {
  if (!keys) {
    return { tone: "neutral", label: "Unknown", detail: "Couldn't read the agent account's keys from NEAR." };
  }
  if (keys.some((key) => key.kind === "full")) {
    return {
      tone: "danger",
      label: "Full-access key",
      detail:
        "The agent's account still has a full-access key, which can do anything with that account. Give the agent a limited key and delete this one.",
    };
  }
  const limited = keys.filter((key) => key.kind === "function");
  if (limited.length && limited.every((key) => key.kind === "function" && key.receiver === vaultId)) {
    return {
      tone: "secure",
      label: "Limited to the vault",
      detail: "Every key on the agent's account can only call the vault, and cannot move NEAR.",
    };
  }
  return {
    tone: "caution",
    label: "Check keys",
    detail: "The agent's account has keys for other contracts. Review them on the Wallet Security page.",
  };
}

export function lastAgentActivity(data: VaultData): number | null {
  const entry = data.activity.find((item) => actorOf(item) === "Agent");
  return entry ? entry.at_ms : null;
}

// ---------------------------------------------------------- overall status

export interface OverallStatus {
  level: "protected" | "attention" | "paused" | "unknown";
  label: string;
  detail: string;
}

export function overallStatus(snapshots: VaultSnapshot[]): OverallStatus {
  const loaded = snapshots.filter((s) => s.data);
  if (!loaded.length) {
    return { level: "unknown", label: "Checking", detail: "Reading your vaults from NEAR testnet." };
  }
  const frozen = loaded.filter((s) => s.data?.status.frozen).length;
  if (frozen) {
    return {
      level: "paused",
      label: "Paused",
      detail: `${frozen} vault${frozen === 1 ? " is" : "s are"} frozen. No agent payments can go out of ${frozen === 1 ? "it" : "them"}.`,
    };
  }
  const pending = loaded.reduce((sum, s) => sum + (s.data?.status.pending_count ?? 0), 0);
  const dayAgo = Date.now() - DAY;
  const critical = loaded.some((s) => s.data?.activity.some((e) => e.at_ms > dayAgo && severityOf(e) === "critical"));
  if (pending || critical) {
    return {
      level: "attention",
      label: "Needs attention",
      detail: pending
        ? `${pending} payment${pending === 1 ? " is" : "s are"} waiting for approval.`
        : "A scam drill failed in the last 24 hours.",
    };
  }
  return { level: "protected", label: "Protected", detail: "Every vault is active and nothing is waiting for you." };
}
