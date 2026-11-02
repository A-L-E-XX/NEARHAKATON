import { ExternalLink, Search, Snowflake } from "lucide-react";
import { useMemo, useState } from "react";
import { ONE_YOCTO, OwnerAction } from "../components/OwnerAction";
import { Badge, Drawer, Empty, Field, Modal, PageHeader, Panel, agentName, cx } from "../components/ui";
import { EXPLORER } from "../config";
import { SEVERITY_RULES, SEVERITY_TONE, threatsFor, type Severity, type Threat, type VaultSnapshot } from "../lib/derive";
import { ago, dateTime } from "../lib/format";
import { useVaults } from "../lib/store";
import type { VaultData } from "../lib/vault";

const LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
type Loaded = VaultSnapshot & { data: VaultData };

export function Threats() {
  const { snapshots } = useVaults();
  const loaded = snapshots.filter((s): s is Loaded => Boolean(s.data));
  const threats = useMemo(
    () =>
      loaded
        .flatMap((s) => threatsFor(s.id, s.data))
        .sort((a, b) => (b.at ?? Number.MAX_SAFE_INTEGER) - (a.at ?? Number.MAX_SAFE_INTEGER)),
    [loaded],
  );
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [text, setText] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const shown = threats.filter((t) => {
    if (severity !== "all" && t.severity !== severity) return false;
    const q = text.trim().toLowerCase();
    if (!q) return true;
    return [t.title, t.category, t.explanation, t.account ?? "", t.agentId].some((v) => v.toLowerCase().includes(q));
  });
  const open = threats.find((t) => t.key === openKey) ?? null;
  const counts = threats.reduce<Record<Severity, number>>(
    (acc, t) => ({ ...acc, [t.severity]: acc[t.severity] + 1 }),
    { critical: 0, high: 0, medium: 0, low: 0 },
  );

  return (
    <>
      <PageHeader
        title="Threat Detection"
        description="Every scam the vaults stopped, every account the agents flagged, and every risk in how the agents are set up. Severity comes from fixed rules you can read."
        actions={
          <button className="text-[13px] text-water hover:underline" onClick={() => setRulesOpen(true)}>
            How severity is decided
          </button>
        }
      />

      <DrillsPanel loaded={loaded} />

      <ReviewQueue loaded={loaded} />

      <Panel
        className="mt-5"
        title="Detected threats"
        description={`${threats.length} in the watched vaults`}
        bodyClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-edge text-[12px]">
              {(["all", "critical", "high", "medium", "low"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSeverity(level)}
                  aria-pressed={severity === level}
                  className={cx(
                    "px-2.5 py-1.5",
                    severity === level ? "bg-white/[0.08] text-snow" : "text-fog hover:text-snow",
                  )}
                >
                  {level === "all" ? "All" : `${LABEL[level]} ${counts[level]}`}
                </button>
              ))}
            </div>
            <label className="relative">
              <span className="sr-only">Search threats</span>
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fog" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Search"
                className="h-8 w-40 rounded-lg border border-edge bg-raised pl-8 pr-2 text-[13px] focus:border-water/60 focus:outline-none"
              />
            </label>
          </div>
        }
      >
        {shown.length === 0 ? (
          <div className="p-5">
            <Empty title={threats.length ? "No threats match these filters." : "No threats detected."}>
              {threats.length ? "Try another severity or search." : "Stopped scams and risky set-ups will show up here."}
            </Empty>
          </div>
        ) : (
          <ul>
            {shown.map((threat) => (
              <li key={threat.key}>
                <button
                  type="button"
                  onClick={() => setOpenKey(threat.key)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5 border-b border-edge px-5 py-3.5 text-left text-[13px] last:border-0 hover:bg-white/[0.03] md:grid-cols-[5.5rem_minmax(0,1.6fr)_minmax(0,1fr)_7rem]"
                >
                  <span className="order-1 md:order-none">
                    <Badge tone={SEVERITY_TONE[threat.severity]}>{LABEL[threat.severity]}</Badge>
                  </span>
                  <span className="order-3 col-span-2 min-w-0 md:order-none md:col-span-1">
                    <span className="block font-semibold text-snow">{threat.title}</span>
                    <span className="block truncate text-fog">{threat.category}</span>
                  </span>
                  <span className="order-4 col-span-2 min-w-0 truncate text-mist md:order-none md:col-span-1">
                    {agentName(threat.vaultId)}
                    {threat.account ? <span className="text-fog">, {threat.account}</span> : null}
                  </span>
                  <span className="order-2 text-right text-fog md:order-none">{threat.at ? ago(threat.at) : "Ongoing"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Drawer open={open !== null} onClose={() => setOpenKey(null)} title="Threat details">
        {open && <ThreatDetails threat={open} ownerId={loaded.find((s) => s.id === open.vaultId)?.data.status.owner_id ?? ""} frozen={loaded.find((s) => s.id === open.vaultId)?.data.status.frozen ?? false} />}
      </Drawer>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="How severity is decided">
        <p className="mb-3">There is no AI score here. Each event gets its severity from one of these rules:</p>
        <ul className="space-y-2">
          {SEVERITY_RULES.map((rule) => (
            <li key={rule.severity} className="flex gap-3">
              <span className="w-16 shrink-0">
                <Badge tone={SEVERITY_TONE[rule.severity]}>{LABEL[rule.severity]}</Badge>
              </span>
              <span>{rule.rule}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

function ThreatDetails({ threat, ownerId, frozen }: { threat: Threat; ownerId: string; frozen: boolean }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge tone={SEVERITY_TONE[threat.severity]}>{LABEL[threat.severity]} severity</Badge>
        <Badge tone="neutral">{threat.category}</Badge>
      </div>
      <h3 className="text-[15px] font-semibold">{threat.title}</h3>
      <dl className="mt-4">
        <Field label="Agent" value={`${agentName(threat.vaultId)} (${threat.agentId})`} />
        <Field label="Account involved" value={threat.account ?? "—"} />
        <Field label="Detected" value={threat.at ? dateTime(threat.at) : "Found in the agent's current set-up"} />
        <Field label="What happened" value={threat.explanation} />
        <Field label="Why this severity" value={SEVERITY_RULES.find((r) => r.severity === threat.severity)?.rule ?? ""} />
        <Field label="Recommended" value={threat.recommended} />
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        {threat.account && threat.kind !== "FullAccessKey" && threat.kind !== "Blocked" && threat.kind !== "DrillFailed" && (
          <OwnerAction
            vaultId={threat.vaultId}
            ownerId={ownerId}
            method="block"
            args={{ account_id: threat.account }}
            variant="danger"
            size="sm"
            label="Block recipient"
            confirmTitle={`Block ${threat.account}`}
            confirmText="The vault will refuse every payment to this account."
            confirmLabel="Block"
            done="Account blocked."
          />
        )}
        {!frozen && (
          <OwnerAction
            vaultId={threat.vaultId}
            ownerId={ownerId}
            method="freeze"
            args={{ reason: `Suspended after: ${threat.title}` }}
            variant="ice"
            size="sm"
            label={
              <>
                <Snowflake size={14} /> Suspend agent
              </>
            }
            confirmTitle="Suspend this agent"
            confirmText="The vault freezes straight away. Nothing can be sent until you unfreeze it."
            confirmLabel="Freeze vault"
            done="Vault frozen."
          />
        )}
        {threat.account && (
          <a
            href={`#/audit?q=${encodeURIComponent(threat.account)}`}
            className="inline-flex h-8 items-center rounded-lg border border-edge bg-raised px-3 text-[13px] font-semibold hover:border-fog/60"
          >
            Investigate in the audit log
          </a>
        )}
      </div>
      {threat.account && (
        <a className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-water hover:underline" href={`${EXPLORER}/address/${threat.account}`}>
          Look up {threat.account} on NearBlocks <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

function DrillsPanel({ loaded }: { loaded: Loaded[] }) {
  const drills = loaded
    .flatMap((s) => s.data.drills.map((d) => ({ ...d, vaultId: s.id })))
    .sort((a, b) => b.started_at_ms - a.started_at_ms);
  const running = loaded.reduce((sum, s) => sum + s.data.status.active_drills, 0);
  return (
    <Panel
      title="Scam drills"
      description={`We plant fake scams in what the agents read. ${running ? `${running} running now, hidden until they end.` : "None running right now."}`}
      bodyClassName="p-0"
    >
      {drills.length === 0 ? (
        <div className="p-5">
          <Empty title="No drills have finished yet." />
        </div>
      ) : (
        <ul>
          {drills.slice(0, 8).map((drill) => (
            <li
              key={`${drill.vaultId}:${drill.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5 border-b border-edge px-5 py-3 text-[13px] last:border-0 md:grid-cols-[5.5rem_minmax(0,1.4fr)_minmax(0,1.2fr)_7rem]"
            >
              <span className="order-1 md:order-none">
                <Badge tone={drill.status === "Reported" ? "secure" : drill.status === "Failed" ? "danger" : "caution"}>
                  {drill.status === "Reported" ? "Passed" : drill.status}
                </Badge>
              </span>
              <span className="order-3 col-span-2 min-w-0 md:order-none md:col-span-1">
                <span className="block font-semibold text-snow">{drill.lure}</span>
                <span className="block text-fog">{agentName(drill.vaultId)}</span>
              </span>
              <span className="order-4 col-span-2 min-w-0 truncate text-mist md:order-none md:col-span-1">
                {drill.status === "Reported"
                  ? `Reported ${drill.decoy_id ?? "the decoy"}`
                  : drill.status === "Failed"
                    ? `Tried to pay ${drill.decoy_id ?? "the decoy"}`
                    : "Not reported in time"}
              </span>
              <span className="order-2 text-right text-fog md:order-none">{ago(drill.started_at_ms)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ReviewQueue({ loaded }: { loaded: Loaded[] }) {
  const items = loaded.flatMap((s) => s.data.lists.reported.map((account) => ({ account, vaultId: s.id, ownerId: s.data.status.owner_id })));
  if (!items.length) return null;
  return (
    <Panel className="mt-5" title="Flagged by the agents" description="Accounts an agent reported as a possible scam. Payments to them wait for you.">
      <ul className="divide-y divide-edge text-[13px]">
        {items.map((item) => (
          <li key={`${item.vaultId}:${item.account}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-snow">{item.account}</span>
              <span className="block text-fog">{agentName(item.vaultId)}</span>
            </span>
            <span className="flex gap-2">
              <OwnerAction
                vaultId={item.vaultId}
                ownerId={item.ownerId}
                method="confirm_report"
                args={{ account_id: item.account }}
                variant="danger"
                size="sm"
                label="Confirm scam"
                confirmTitle={`Block ${item.account}`}
                confirmText="The account moves to the blocklist and every payment to it will be refused."
                confirmLabel="Confirm and block"
                done="Confirmed and blocked."
              />
              <OwnerAction
                vaultId={item.vaultId}
                ownerId={item.ownerId}
                method="dismiss_report"
                args={{ account_id: item.account }}
                deposit={ONE_YOCTO}
                size="sm"
                label="It's fine"
                confirmTitle={`Clear ${item.account}`}
                confirmText="The account is cleared. It was a false alarm, so the agent loses 3 points."
                confirmLabel="Clear the report"
                done="Report dismissed."
              />
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
