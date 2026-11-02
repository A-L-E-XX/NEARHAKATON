import { type AccessKey, view, viewAccessKeys } from "./near";

export type Tier = "Probation" | "Learner" | "Trusted";
export type DrillStatus = "Active" | "Reported" | "Failed" | "Missed";
export type ActivityKind =
  | "Sent"
  | "Held"
  | "Approved"
  | "Rejected"
  | "Blocked"
  | "DrillPassed"
  | "DrillFailed"
  | "DrillMissed"
  | "ScamReported"
  | "ReportDismissed"
  | "Frozen"
  | "Unfrozen"
  | "TransferFailed"
  | "SettingsChanged"
  | "Withdrawn";

export interface Policy {
  max_per_payment: string;
  daily_limit: string;
  max_requests_per_day: number;
  allowlist_only: boolean;
}

export interface Status {
  owner_id: string;
  agent_id: string;
  drill_operator_id: string;
  frozen: boolean;
  score: number;
  tier: Tier;
  policy: Policy;
  agent_max_per_payment: string;
  agent_daily_limit: string;
  spent_today: string;
  requests_today: number;
  available_balance: string;
  pending_count: number;
  active_drills: number;
  stats: {
    drills_started: number;
    drills_reported: number;
    drills_failed: number;
    drills_missed: number;
    payments_sent: number;
    payments_held: number;
    payments_blocked: number;
    false_alarms: number;
  };
}

export interface Drill {
  id: number;
  lure: string;
  decoy_id: string | null;
  started_at_ms: number;
  expires_at_ms: number;
  status: DrillStatus;
}

export interface PendingPayment {
  id: number;
  receiver_id: string;
  amount: string;
  memo: string | null;
  reasons: string[];
  created_at_ms: number;
}

export interface Activity {
  id: number;
  at_ms: number;
  kind: ActivityKind;
  receiver_id: string | null;
  amount: string | null;
  score_change: number;
  message: string;
}

export interface Lists {
  allowlist: string[];
  blocklist: string[];
  reported: string[];
}

export interface VaultData {
  status: Status;
  drills: Drill[];
  pending: PendingPayment[];
  activity: Activity[];
  lists: Lists;
  agentKeys: AccessKey[] | null;
}

export async function readVault(vaultId: string): Promise<VaultData> {
  const [status, drills, pending, activity, lists] = await Promise.all([
    view<Status>(vaultId, "get_status"),
    view<Drill[]>(vaultId, "get_drills", { limit: 50 }),
    view<PendingPayment[]>(vaultId, "get_pending"),
    view<Activity[]>(vaultId, "get_activity", { limit: 100 }),
    view<Lists>(vaultId, "get_lists"),
  ]);
  const agentKeys = await viewAccessKeys(status.agent_id).catch(() => null);
  return { status, drills, pending, activity, lists, agentKeys };
}
