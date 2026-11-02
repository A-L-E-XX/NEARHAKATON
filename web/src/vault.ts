import { JsonRpcProvider } from "near-api-js";
import { useCallback, useEffect, useState } from "react";
import { RPC_URL } from "./config";

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

export interface Status {
  owner_id: string;
  agent_id: string;
  drill_operator_id: string;
  frozen: boolean;
  score: number;
  tier: Tier;
  policy: { max_per_payment: string; daily_limit: string; max_requests_per_day: number; allowlist_only: boolean };
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
}

const provider = new JsonRpcProvider({ url: RPC_URL });

async function view<T>(vaultId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  const result: unknown = await provider.callFunction({ contractId: vaultId, method, args });
  return result as T;
}

export async function readVault(vaultId: string): Promise<VaultData> {
  const [status, drills, pending, activity, lists] = await Promise.all([
    view<Status>(vaultId, "get_status"),
    view<Drill[]>(vaultId, "get_drills", { limit: 20 }),
    view<PendingPayment[]>(vaultId, "get_pending"),
    view<Activity[]>(vaultId, "get_activity", { limit: 40 }),
    view<Lists>(vaultId, "get_lists"),
  ]);
  return { status, drills, pending, activity, lists };
}

/** Reads the vault from NEAR testnet and refreshes it every 15 seconds. */
export function useVault(vaultId: string) {
  const [data, setData] = useState<VaultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await readVault(vaultId));
      setError(null);
    } catch (err) {
      setError(explain(err, vaultId));
    }
  }, [vaultId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { data, error, refresh };
}

function explain(err: unknown, vaultId: string): string {
  const text = err instanceof Error ? err.message : String(err);
  if (/does not exist|doesn't exist|UNKNOWN_ACCOUNT/i.test(text)) {
    return `There is no account called ${vaultId} on NEAR testnet. Check the vault name.`;
  }
  if (/CodeDoesNotExist|no contract|MethodNotFound/i.test(text)) {
    return `${vaultId} exists but is not a Phishbowl vault.`;
  }
  return `Could not read the vault from NEAR testnet: ${text.slice(0, 160)}`;
}

const ONE_NEAR = 10n ** 24n;

/** "10000000000000000000000" -> "0.01 NEAR". */
export function near(yocto: string | null | undefined, maxDecimals = 3): string {
  if (!yocto) return "0 NEAR";
  const value = BigInt(yocto);
  const whole = value / ONE_NEAR;
  const scale = 10n ** BigInt(24 - maxDecimals);
  const fraction = ((value % ONE_NEAR) / scale).toString().padStart(maxDecimals, "0").replace(/0+$/, "");
  if (whole === 0n && !fraction && value > 0n) return `less than 0.${"0".repeat(maxDecimals - 1)}1 NEAR`;
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""} NEAR`;
}

export function when(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}
