import type { ActivityKind, DrillStatus } from "./vault";

export type Tone = "good" | "bad" | "warn" | "ice" | "plain";

export const ACTIVITY: Record<ActivityKind, { label: string; tone: Tone }> = {
  Sent: { label: "Paid", tone: "plain" },
  Held: { label: "Waiting for owner", tone: "warn" },
  Approved: { label: "Approved", tone: "plain" },
  Rejected: { label: "Rejected", tone: "warn" },
  Blocked: { label: "Blocked", tone: "bad" },
  DrillPassed: { label: "Drill passed", tone: "good" },
  DrillFailed: { label: "Drill failed", tone: "bad" },
  DrillMissed: { label: "Drill missed", tone: "warn" },
  ScamReported: { label: "Reported", tone: "good" },
  ReportDismissed: { label: "False alarm", tone: "warn" },
  Frozen: { label: "Frozen", tone: "ice" },
  Unfrozen: { label: "Unfrozen", tone: "plain" },
  TransferFailed: { label: "Transfer failed", tone: "bad" },
  SettingsChanged: { label: "Settings", tone: "plain" },
  Withdrawn: { label: "Withdrawn", tone: "plain" },
};

export const DRILL: Record<DrillStatus, { label: string; tone: Tone }> = {
  Active: { label: "Running", tone: "plain" },
  Reported: { label: "Passed", tone: "good" },
  Failed: { label: "Failed", tone: "bad" },
  Missed: { label: "Missed", tone: "warn" },
};

export function drillOutcome(status: DrillStatus, decoy: string | null): string {
  const who = decoy ?? "the decoy account";
  switch (status) {
    case "Reported":
      return `The agent spotted it and reported ${who}.`;
    case "Failed":
      return `The agent tried to pay ${who}. Nothing was sent and the vault froze.`;
    case "Missed":
      return "The agent didn't report it before the drill ended.";
    default:
      return "Still running.";
  }
}

export const TIER_HELP: Record<string, string> = {
  Probation: "Every payment waits for the owner.",
  Learner: "Small payments go through on their own.",
  Trusted: "Most everyday payments go through on their own.",
};
