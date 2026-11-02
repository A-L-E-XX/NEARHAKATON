import { ArrowLeft, ExternalLink, KeyRound, Snowflake } from "lucide-react";
import { useEffect } from "react";
import { Bowl } from "../components/Bowl";
import { ONE_YOCTO, OwnerAction } from "../components/OwnerAction";
import { TxTable } from "../components/TxTable";
import { Badge, Button, ErrorNote, Field, Loading, Panel, agentName } from "../components/ui";
import { EXPLORER, NETWORK_LABEL } from "../config";
import { agentState, keyCheck, lastAgentActivity, transactionsFor } from "../lib/derive";
import { ago, near, shortKey } from "../lib/format";
import { useVaults } from "../lib/store";
import type { VaultData } from "../lib/vault";

export function AgentDetail({ vaultId }: { vaultId: string }) {
  const { snapshots, watched, addVault, select } = useVaults();
  const snap = snapshots.find((s) => s.id === vaultId);

  useEffect(() => {
    if (watched.includes(vaultId)) select(vaultId);
  }, [vaultId, watched, select]);

  const back = (
    <a href="#/agents" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fog hover:text-snow">
      <ArrowLeft size={14} /> All agents
    </a>
  );

  if (!watched.includes(vaultId)) {
    return (
      <>
        {back}
        <Panel title={vaultId}>
          <p className="mb-4 text-sm text-mist">You're not watching this vault yet.</p>
          <Button variant="primary" onClick={() => addVault(vaultId)}>
            Watch this vault
          </Button>
        </Panel>
      </>
    );
  }
  if (!snap?.data) {
    return (
      <>
        {back}
        {snap?.error ? <ErrorNote>{snap.error}</ErrorNote> : <Loading />}
      </>
    );
  }
  return (
    <>
      {back}
      <Detail vaultId={vaultId} data={snap.data} />
    </>
  );
}

function Detail({ vaultId, data }: { vaultId: string; data: VaultData }) {
  const { status } = data;
  const state = agentState(status);
  const key = keyCheck(vaultId, data.agentKeys);
  const last = lastAgentActivity(data);
  const txs = transactionsFor(vaultId, data);
  const incidents = status.stats.drills_failed + data.activity.filter((e) => e.kind === "Frozen" && /itself/i.test(e.message)).length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">{agentName(vaultId)}</h1>
          <p className="mt-1 text-[13px] text-fog">{status.agent_id}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span title={state.why}>
              <Badge tone={state.tone}>{state.label}</Badge>
            </span>
            <span title={key.detail}>
              <Badge tone={key.tone} icon={<KeyRound size={12} />}>
                {key.label}
              </Badge>
            </span>
            <Badge tone="neutral">{last ? `Last active ${ago(last)}` : "No activity yet"}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status.frozen ? (
            <OwnerAction
              vaultId={vaultId}
              ownerId={status.owner_id}
              method="unfreeze"
              deposit={ONE_YOCTO}
              variant="primary"
              label="Resume agent"
              confirmTitle="Unfreeze the vault"
              confirmText="The agent will be able to send payments within its limits again. Check the threat log first if it fell for a scam drill."
              confirmLabel="Unfreeze vault"
              done="Vault unfrozen. The agent can pay again within its limits."
            />
          ) : (
            <OwnerAction
              vaultId={vaultId}
              ownerId={status.owner_id}
              method="freeze"
              args={{ reason: "Suspended from the agent page" }}
              variant="ice"
              label={
                <>
                  <Snowflake size={15} /> Suspend agent
                </>
              }
              confirmTitle="Suspend this agent"
              confirmText="The vault freezes straight away. Nothing can be sent until you unfreeze it, which needs your wallet's approval."
              confirmLabel="Freeze vault"
              done="Vault frozen. The agent can't send anything."
            />
          )}
          <a href="#/spending" className="inline-flex h-10 items-center rounded-lg border border-edge bg-raised px-4 text-sm font-semibold hover:border-fog/60">
            Set spending limits
          </a>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel title="Spending power">
            <div className="flex justify-center">
              <Bowl score={status.score} frozen={status.frozen} activeDrills={status.active_drills} size={200} />
            </div>
            <p className="mt-3 text-center text-[13px] text-fog">
              Score <span className="tabular text-[18px] font-semibold text-snow">{status.score}</span> of 100, level {status.tier}
            </p>
            <dl className="mt-4">
              <Field label="Per payment now" value={near(status.agent_max_per_payment)} mono />
              <Field label="Per day now" value={near(status.agent_daily_limit)} mono />
              <Field label="Sent today" value={near(status.spent_today)} mono />
              <Field label="In the vault" value={near(status.available_balance)} mono />
            </dl>
          </Panel>

          <Panel title="Risk assessment" description="Each line comes from a fixed check, not an AI guess">
            <ul className="space-y-3 text-[13px]">
              <Check tone={key.tone} title={`Agent key: ${key.label.toLowerCase()}`} detail={key.detail} />
              <Check
                tone={status.stats.drills_failed ? "danger" : status.stats.drills_reported ? "secure" : "neutral"}
                title={`Scam drills: ${status.stats.drills_reported} passed, ${status.stats.drills_failed} failed, ${status.stats.drills_missed} missed`}
                detail={
                  status.stats.drills_failed
                    ? "It has paid a fake scam before. Its limits dropped and the vault froze."
                    : "It hasn't fallen for a drill yet."
                }
              />
              <Check
                tone={incidents ? "danger" : "secure"}
                title={`${incidents} security incident${incidents === 1 ? "" : "s"}`}
                detail="Failed drills and automatic freezes."
              />
              <Check
                tone={status.pending_count ? "caution" : "secure"}
                title={`${status.pending_count} payment${status.pending_count === 1 ? "" : "s"} waiting`}
                detail="Payments above its limits wait for the owner."
              />
            </ul>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Identity and roles">
            <dl>
              <Field label="Agent account" value={status.agent_id} />
              <Field
                label="Vault"
                value={
                  <a className="inline-flex items-center gap-1 text-water hover:underline" href={`${EXPLORER}/address/${vaultId}`}>
                    {vaultId} <ExternalLink size={12} />
                  </a>
                }
              />
              <Field label="Owner" value={status.owner_id} />
              <Field label="Drill operator" value={status.drill_operator_id} />
              <Field label="Network" value={NETWORK_LABEL} />
            </dl>
          </Panel>

          <Panel title="Permissions" description="What the agent can do, checked live on NEAR">
            <p className="mb-3 text-[13px] text-mist">
              In the vault, the agent can only ask to pay, report a scam, or freeze the vault. It can't unfreeze it, change
              limits, approve its own payments or run drills.
            </p>
            {data.agentKeys === null ? (
              <p className="text-[13px] text-fog">Couldn't read the agent account's keys.</p>
            ) : (
              <ul className="divide-y divide-edge rounded-lg border border-edge">
                {data.agentKeys.map((k) => (
                  <li key={k.publicKey} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-[13px]">
                    <span className="min-w-0">
                      <span className="tabular block text-snow">{shortKey(k.publicKey)}</span>
                      <span className="block text-fog">
                        {k.kind === "full"
                          ? "Full access: can move NEAR, add keys and call any contract."
                          : `Can call ${k.methods.length ? k.methods.join(", ") : "any method"} on ${k.receiver}. Gas allowance: ${
                              k.allowance ? near(k.allowance) : "unlimited"
                            }. Cannot move NEAR.`}
                      </span>
                    </span>
                    <Badge tone={k.kind === "full" ? "danger" : k.receiver === vaultId ? "secure" : "caution"}>
                      {k.kind === "full" ? "Full access" : "Function call"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Transaction history"
            action={
              <a href="#/transactions" className="text-[13px] text-water hover:underline">
                Open the monitor
              </a>
            }
            bodyClassName="px-0 pb-0 pt-3"
          >
            <TxTable txs={txs.slice(0, 12)} ownerOf={() => status.owner_id} showAgent={false} emptyText="No payments yet." />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Check({ tone, title, detail }: { tone: "secure" | "caution" | "danger" | "neutral" | "ice" | "brand"; title: string; detail: string }) {
  const color = { secure: "bg-secure", caution: "bg-caution", danger: "bg-danger", neutral: "bg-fog", ice: "bg-ice", brand: "bg-water" }[tone];
  return (
    <li className="flex gap-3">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span>
        <span className="block text-snow">{title}</span>
        <span className="block text-fog">{detail}</span>
      </span>
    </li>
  );
}
