import { CirclePause, Clock, Lock, Network } from "lucide-react";
import { useNearWallet } from "near-connect-hooks";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useVaultCall } from "../components/OwnerAction";
import { Badge, Button, Empty, Loading, Modal, Panel, Progress, TONE_DOT, agentName, cx } from "../components/ui";
import { NETWORK_LABEL } from "../config";
import {
  KIND,
  SEVERITY_RULES,
  SEVERITY_TONE,
  dailyActivity,
  overallStatus,
  severityCounts,
  type Severity,
  type VaultSnapshot,
} from "../lib/derive";
import { ago, near } from "../lib/format";
import { useVaults } from "../lib/store";
import type { Activity, VaultData } from "../lib/vault";

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function greeting(now: number): string {
  const hour = new Date(now).getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type Loaded = VaultSnapshot & { data: VaultData };

export function Overview() {
  const { snapshots, firstLoad } = useVaults();
  const { signedAccountId } = useNearWallet();
  const now = useNow();
  const loaded = snapshots.filter((s): s is Loaded => Boolean(s.data));
  const status = overallStatus(snapshots);

  const totalBalance = loaded.reduce((sum, s) => sum + BigInt(s.data.status.available_balance), 0n);
  const active = loaded.filter((s) => !s.data.status.frozen).length;
  const monitored = loaded.reduce(
    (sum, s) => sum + s.data.status.stats.payments_sent + s.data.status.stats.payments_held + s.data.status.stats.payments_blocked,
    0,
  );
  const intercepted = loaded.reduce(
    (sum, s) => sum + s.data.status.stats.payments_blocked + s.data.status.stats.drills_reported,
    0,
  );
  const pending = loaded.reduce((sum, s) => sum + s.data.status.pending_count, 0);
  const activity: Array<Activity & { vaultId: string }> = loaded
    .flatMap((s) => s.data.activity.map((entry) => ({ ...entry, vaultId: s.id })))
    .sort((a, b) => b.at_ms - a.at_ms);

  const stats = [
    { label: "Protected assets", value: near(totalBalance.toString()), hint: "Spendable NEAR held in the vaults" },
    { label: "Active AI agents", value: `${active} of ${snapshots.length}`, hint: "Agents whose vault isn't frozen" },
    { label: "Transactions monitored", value: monitored.toString(), hint: "Payment requests the vaults decided" },
    { label: "Threats intercepted", value: intercepted.toString(), hint: "Blocked payments and scams reported" },
    { label: "Pending approvals", value: pending.toString(), hint: pending ? "Waiting for the owner" : "Nothing waiting" },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-fog">
            {greeting(now)}
            {signedAccountId ? `, ${signedAccountId}` : ""}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-[22px]">Here's what your agents did</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-fog">
            <span className="inline-flex items-baseline gap-1.5">
              <span
                className={cx(
                  "h-2 w-2 shrink-0 self-center rounded-full",
                  status.level === "protected" ? TONE_DOT.secure : status.level === "paused" ? TONE_DOT.ice : status.level === "attention" ? TONE_DOT.caution : TONE_DOT.neutral,
                )}
              />
              <span>
                <span className="text-mist">{status.label}.</span> {status.detail}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} />
              {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(now))}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Network size={14} />
              {NETWORK_LABEL}
            </span>
          </div>
        </div>
        <EmergencyPause loaded={loaded} />
      </div>

      {firstLoad && !loaded.length ? (
        <Loading />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-edge bg-edge xl:grid-cols-5">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={cx(
                  "bg-panel px-4 py-4 sm:px-5",
                  index === stats.length - 1 && stats.length % 2 === 1 && "col-span-2 xl:col-span-1",
                )}
              >
                <dt className="text-[13px] text-fog">{stat.label}</dt>
                <dd className="tabular mt-1 text-[22px] font-semibold tracking-tight text-snow">{stat.value}</dd>
                <p className="mt-0.5 text-[12px] text-fog">{stat.hint}</p>
              </div>
            ))}
          </dl>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <Panel
              title="Payment activity"
              description="What the agents asked to pay, per day, over the last 14 days"
              className="xl:col-span-2"
            >
              <ActivityChart entries={activity} />
            </Panel>
            <ThreatOverview snapshots={snapshots} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <Panel
              title="Security activity"
              description="The latest decisions across all vaults"
              className="xl:col-span-2"
              action={
                <a href="#/audit" className="text-[13px] text-water hover:underline">
                  Open the audit log
                </a>
              }
              bodyClassName="px-0 py-0"
            >
              <Feed entries={activity.slice(0, 8)} />
            </Panel>
            <DrillSummary loaded={loaded} />
          </div>
        </>
      )}
    </>
  );
}

function ActivityChart({ entries }: { entries: Activity[] }) {
  const series = dailyActivity(entries);
  const total = series.reduce((sum, day) => sum + day.sent + day.held + day.blocked, 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-[12px] text-fog">
        <Legend color="bg-secure" label="Paid" />
        <Legend color="bg-caution" label="Held for owner" />
        <Legend color="bg-danger" label="Blocked" />
      </div>
      <div className="relative h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#1e2b42" />
            <XAxis dataKey="day" tick={{ fill: "#8d9db3", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis allowDecimals={false} tick={{ fill: "#8d9db3", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{ background: "#142036", border: "1px solid #1e2b42", borderRadius: 8, color: "#eaf0f7", fontSize: 12 }}
              labelStyle={{ color: "#c3cfdd" }}
            />
            <Bar dataKey="sent" name="Paid" stackId="a" fill="#34d399" />
            <Bar dataKey="held" name="Held for owner" stackId="a" fill="#f5b544" />
            <Bar dataKey="blocked" name="Blocked" stackId="a" fill="#f26b6b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {total === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-fog">
            No payment requests in the last 14 days.
          </p>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("h-2.5 w-2.5 rounded-sm", color)} />
      {label}
    </span>
  );
}

const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

function ThreatOverview({ snapshots }: { snapshots: VaultSnapshot[] }) {
  const counts = severityCounts(snapshots);
  const max = Math.max(1, ...Object.values(counts));
  const [open, setOpen] = useState(false);
  return (
    <Panel
      title="Threat overview"
      description="Events by severity, from fixed rules"
      action={
        <button className="text-[13px] text-water hover:underline" onClick={() => setOpen(true)}>
          How it's decided
        </button>
      }
    >
      <ul className="space-y-4">
        {(Object.keys(counts) as Severity[]).map((severity) => (
          <li key={severity}>
            <div className="mb-1.5 flex items-center justify-between text-[13px]">
              <span className="text-mist">{SEVERITY_LABEL[severity]}</span>
              <span className="tabular font-semibold">{counts[severity]}</span>
            </div>
            <Progress value={counts[severity]} max={max} tone={SEVERITY_TONE[severity]} />
          </li>
        ))}
      </ul>
      <a href="#/threats" className="mt-5 inline-block text-[13px] text-water hover:underline">
        Open Threat Detection
      </a>
      <Modal open={open} onClose={() => setOpen(false)} title="How severity is decided">
        <p className="mb-3">Phishbowl doesn't use an AI score here. Each event gets a severity from a fixed rule:</p>
        <ul className="space-y-2">
          {SEVERITY_RULES.map((rule) => (
            <li key={rule.severity} className="flex gap-3">
              <span className="w-16 shrink-0">
                <Badge tone={SEVERITY_TONE[rule.severity]}>{SEVERITY_LABEL[rule.severity]}</Badge>
              </span>
              <span>{rule.rule}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </Panel>
  );
}

export function Feed({ entries, showAgent = true }: { entries: Array<Activity & { vaultId?: string }>; showAgent?: boolean }) {
  if (!entries.length) {
    return (
      <div className="p-5">
        <Empty title="No activity yet">Payments, blocks and drills will appear here as soon as the agent acts.</Empty>
      </div>
    );
  }
  return (
    <ul>
      {entries.map((entry) => (
        <li key={`${entry.vaultId ?? ""}:${entry.id}`} className="flex gap-3 border-b border-edge px-5 py-3.5 last:border-0">
          <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE_DOT[KIND[entry.kind].tone])} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[13px] font-semibold text-snow">{KIND[entry.kind].label}</span>
              {showAgent && entry.vaultId && <span className="text-[12px] text-fog">{agentName(entry.vaultId)}</span>}
            </div>
            <p className="mt-0.5 break-words text-[13px] text-mist">{entry.message}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[12px] text-fog">{ago(entry.at_ms)}</p>
            {entry.score_change !== 0 && (
              <p className={cx("tabular text-[13px] font-semibold", entry.score_change > 0 ? "text-secure" : "text-danger")}>
                {entry.score_change > 0 ? `+${entry.score_change}` : `−${-entry.score_change}`}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DrillSummary({ loaded }: { loaded: Loaded[] }) {
  const totals = loaded.reduce(
    (sum, s) => ({
      passed: sum.passed + s.data.status.stats.drills_reported,
      failed: sum.failed + s.data.status.stats.drills_failed,
      missed: sum.missed + s.data.status.stats.drills_missed,
      running: sum.running + s.data.status.active_drills,
    }),
    { passed: 0, failed: 0, missed: 0, running: 0 },
  );
  const recent = loaded
    .flatMap((s) => s.data.drills.map((drill) => ({ ...drill, vaultId: s.id })))
    .sort((a, b) => b.started_at_ms - a.started_at_ms)
    .slice(0, 3);
  return (
    <Panel title="Scam drills" description="We send the agents fake scams on purpose">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-edge bg-edge text-center">
        <DrillCount label="Passed" value={totals.passed} tone="text-secure" />
        <DrillCount label="Failed" value={totals.failed} tone="text-danger" />
        <DrillCount label="Missed" value={totals.missed} tone="text-caution" />
      </div>
      <p className="mt-3 text-[13px] text-fog">
        {totals.running
          ? `${totals.running} drill${totals.running === 1 ? " is" : "s are"} running now. They stay hidden until they end.`
          : "No drill is running right now."}
      </p>
      <ul className="mt-3 space-y-2.5">
        {recent.map((drill) => (
          <li key={`${drill.vaultId}:${drill.id}`} className="flex items-start justify-between gap-3 text-[13px]">
            <span className="min-w-0">
              <span className="block truncate text-snow">{drill.lure}</span>
              <span className="text-fog">{ago(drill.started_at_ms)}</span>
            </span>
            <Badge tone={drill.status === "Reported" ? "secure" : drill.status === "Failed" ? "danger" : "caution"}>
              {drill.status === "Reported" ? "Passed" : drill.status}
            </Badge>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function DrillCount({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-panel px-2 py-3">
      <p className={cx("tabular text-xl font-semibold", tone)}>{value}</p>
      <p className="text-[12px] text-fog">{label}</p>
    </div>
  );
}

function EmergencyPause({ loaded }: { loaded: Loaded[] }) {
  const { signedAccountId, signIn } = useNearWallet();
  const call = useVaultCall();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const owned = loaded.filter((s) => s.data.status.owner_id === signedAccountId && !s.data.status.frozen);

  async function pauseAll() {
    setBusy(true);
    for (const snap of owned) {
      await call(snap.id, "freeze", { reason: "Emergency pause from the dashboard" }, { done: `${agentName(snap.id)} paused.` });
    }
    setBusy(false);
    setOpen(false);
  }

  const ownsAny = loaded.some((s) => s.data.status.owner_id === signedAccountId);
  if (!ownsAny) {
    return (
      <span title="Only a vault's owner can pause it" className="inline-flex">
        <Button variant="danger" disabled aria-label="Owner only: Emergency pause">
          <Lock size={14} aria-hidden="true" />
          Emergency pause
        </Button>
      </span>
    );
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <CirclePause size={16} />
        Emergency pause
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pause your agents"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {!signedAccountId ? (
              <Button variant="primary" onClick={() => void signIn()}>
                Connect wallet
              </Button>
            ) : (
              <Button variant="danger" disabled={!owned.length || busy} onClick={() => void pauseAll()}>
                {busy ? "Waiting for your wallet" : `Freeze ${owned.length} vault${owned.length === 1 ? "" : "s"}`}
              </Button>
            )}
          </>
        }
      >
        <p>
          This freezes every vault you own. Frozen agents can't send anything, but they can still report scams. Freezing
          takes one confirmation per vault; unfreezing later needs your wallet's approval.
        </p>
        {signedAccountId && !owned.length && (
          <p className="mt-3 text-caution">You don't own any active vault on this list, so there is nothing to pause.</p>
        )}
        {owned.length > 0 && (
          <ul className="mt-3 list-disc pl-5">
            {owned.map((snap) => (
              <li key={snap.id}>{agentName(snap.id)}</li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
