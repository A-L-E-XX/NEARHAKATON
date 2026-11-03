import { Bowl } from "../components/Bowl";
import { VaultGate } from "../components/VaultGate";
import { Badge, Field, PageHeader, Panel, VaultPicker, agentName, cx } from "../components/ui";
import { actorOf, keyCheck, type VaultSnapshot } from "../lib/derive";
import { near } from "../lib/format";
import { useVaults } from "../lib/store";
import type { VaultData } from "../lib/vault";

const POINTS: Array<{ event: string; points: string; tone: "secure" | "danger" | "caution" | "neutral" }> = [
  { event: "Reports a scam drill", points: "+10", tone: "secure" },
  { event: "Tries to pay a scam drill (the vault also freezes)", points: "−30", tone: "danger" },
  { event: "Tries to pay a blocked account", points: "−15", tone: "danger" },
  { event: "The owner rejects one of its payments", points: "−5", tone: "caution" },
  { event: "Reports an account that turns out to be fine", points: "−3", tone: "caution" },
  { event: "Lets a drill expire without reporting it", points: "0", tone: "neutral" },
];

type Loaded = VaultSnapshot & { data: VaultData };

export function Reputation() {
  return (
    <>
      <PageHeader
        title="Trust & Reputation"
        description="An agent earns trust by spotting scams, not by spending. The score is a record of behaviour, not a guarantee."
        actions={<VaultPicker />}
      />
      <VaultGate>{(vaultId, data) => <Body vaultId={vaultId} data={data} />}</VaultGate>
      <Leaderboard />
    </>
  );
}

function Body({ vaultId, data }: { vaultId: string; data: VaultData }) {
  const { status } = data;
  const s = status.stats;
  const requests = s.payments_sent + s.payments_held + s.payments_blocked;
  const ratio = requests ? Math.round((s.payments_sent / requests) * 100) : null;
  const incidents = s.drills_failed + data.activity.filter((e) => e.kind === "Frozen" && actorOf(e) === "Vault").length;
  const key = keyCheck(vaultId, data.agentKeys);

  const recipients = new Map<string, { count: number; total: bigint }>();
  for (const entry of data.activity) {
    if ((entry.kind === "Sent" || entry.kind === "Approved") && entry.receiver_id) {
      const current = recipients.get(entry.receiver_id) ?? { count: 0, total: 0n };
      recipients.set(entry.receiver_id, { count: current.count + 1, total: current.total + BigInt(entry.amount ?? "0") });
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Panel title={agentName(vaultId)} description={status.agent_id}>
          <div className="flex justify-center">
            <Bowl score={status.score} frozen={status.frozen} activeDrills={status.active_drills} size={210} />
          </div>
          <p className="mt-3 text-center">
            <span className="tabular text-[28px] font-semibold">{status.score}</span>
            <span className="text-fog"> / 100</span>
          </p>
          <p className="text-center text-[13px] text-fog">Level: {status.tier}</p>
          <p className="mt-4 text-[13px] text-fog">
            Under 20 is probation: every payment waits for the owner. From 20 the agent gets its score as a percentage of the
            owner's limits, so at {status.score} it can send {near(status.agent_max_per_payment)} per payment
            {status.frozen ? " once the vault is unfrozen" : ""}.
          </p>
        </Panel>

        <Panel title="How the score is calculated" description="Applied by the vault contract on NEAR; nobody can edit a drill result">
          <ul className="divide-y divide-edge text-[13px]">
            {POINTS.map((row) => (
              <li key={row.event} className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-mist">{row.event}</span>
                <span
                  className={cx(
                    "tabular w-10 text-right font-semibold",
                    row.tone === "secure" ? "text-secure" : row.tone === "danger" ? "text-danger" : row.tone === "caution" ? "text-caution" : "text-fog",
                  )}
                >
                  {row.points}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] text-fog">
            New agents start at 30. The owner can reset the score, but that doesn't change the drill record below, so a
            leaderboard built from drill results stays honest.
          </p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Track record">
          <dl>
            <Field label="Scam drills" value={`${s.drills_reported} passed, ${s.drills_failed} failed, ${s.drills_missed} missed`} />
            <Field label="Payment requests" value={`${requests} (${s.payments_sent} sent, ${s.payments_held} held, ${s.payments_blocked} blocked)`} />
            <Field label="Sent without help" value={ratio === null ? "No requests yet" : `${ratio}% of requests`} />
            <Field label="Security incidents" value={`${incidents} (failed drills and automatic freezes)`} />
            <Field label="False alarms" value={String(s.false_alarms)} />
            <Field label="Disputes" value="None recorded. The vault has no dispute process yet." />
          </dl>
        </Panel>

        <Panel title="Identity and credentials" description="Identity and reputation are different things">
          <dl>
            <Field label="Verified identity" value={<Badge tone="neutral">Not verified</Badge>} />
            <Field label="Agent account" value={status.agent_id} />
            <Field label="Agent key" value={<Badge tone={key.tone}>{key.label}</Badge>} />
            <Field label="Drill operator" value={status.drill_operator_id} />
          </dl>
          <p className="mt-3 text-[13px] text-fog">
            Phishbowl doesn't check who runs an agent. The score only says how this agent behaved in drills and payments.
          </p>
        </Panel>
      </div>

      <Panel title="Recipients" description="Accounts this agent has paid, from the vault's activity log">
        {recipients.size === 0 ? (
          <p className="text-[13px] text-fog">The agent hasn't paid anyone yet.</p>
        ) : (
          <ul className="divide-y divide-edge text-[13px]">
            {[...recipients.entries()].map(([account, info]) => (
              <li key={account} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-snow">{account}</span>
                <span className="flex items-center gap-3 text-fog">
                  <span className="tabular">
                    {info.count} payment{info.count === 1 ? "" : "s"}, {near(info.total.toString())}
                  </span>
                  {data.lists.blocklist.includes(account) && <Badge tone="danger">Blocked</Badge>}
                  {data.lists.allowlist.includes(account) && <Badge tone="secure">Approved</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Leaderboard() {
  const { snapshots } = useVaults();
  const loaded = snapshots.filter((s): s is Loaded => Boolean(s.data));
  if (loaded.length < 2) return null;
  const ranked = [...loaded].sort((a, b) => {
    const sa = a.data.status.stats;
    const sb = b.data.status.stats;
    return sb.drills_reported - sb.drills_failed - (sa.drills_reported - sa.drills_failed) || b.data.status.score - a.data.status.score;
  });
  return (
    <Panel className="mt-5" title="Leaderboard" description="Ranked by drills passed minus drills failed. Each league agent runs a different AI model against the same five drills.">
      <ol className="divide-y divide-edge text-[13px]">
        {ranked.map((snap, index) => (
          <li key={snap.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
            <span className="tabular text-fog">{index + 1}</span>
            <span className="min-w-0 truncate text-snow">{agentName(snap.id)}</span>
            <span className="tabular text-fog">
              {snap.data.status.stats.drills_reported} passed, {snap.data.status.stats.drills_failed} failed, score{" "}
              {snap.data.status.score}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
