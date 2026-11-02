import { ChevronRight, Plus } from "lucide-react";
import { Badge, Empty, PageHeader, Progress, agentName, cx } from "../components/ui";
import { AGENT_NAMES } from "../config";
import { agentState, keyCheck, lastAgentActivity } from "../lib/derive";
import { ago, near, nearFloat } from "../lib/format";
import { useVaults } from "../lib/store";

const COLUMNS = "lg:grid-cols-[minmax(0,1.6fr)_8.5rem_9.5rem_7.5rem_minmax(0,1fr)_5rem_6.5rem_1rem]";

export function Agents() {
  const { snapshots } = useVaults();
  return (
    <>
      <PageHeader
        title="AI Agents"
        description="Each agent pays from its own Phishbowl vault on NEAR. The agent can only ask; the vault decides, and its limits follow the agent's score."
        actions={
          <a
            href="#/start"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-snow px-4 text-sm font-semibold text-night hover:bg-white"
          >
            <Plus size={16} />
            Register an agent
          </a>
        }
      />

      {snapshots.length === 0 ? (
        <Empty title="No agents yet">
          <a className="underline" href="#/start">
            Register your first agent
          </a>{" "}
          or add an existing vault in Settings.
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-edge bg-panel">
          <div className={cx("hidden gap-3 border-b border-edge px-5 py-2.5 text-[12px] text-fog lg:grid", COLUMNS)}>
            <span>Agent</span>
            <span>Status</span>
            <span>Agent key</span>
            <span>Per payment now</span>
            <span>Spent today</span>
            <span>Score</span>
            <span>Last active</span>
            <span />
          </div>
          <ul>
            {snapshots.map((snap) => {
              const data = snap.data;
              const href = `#/agents/${encodeURIComponent(snap.id)}`;
              if (!data) {
                return (
                  <li key={snap.id} className="border-b border-edge px-5 py-4 text-[13px] last:border-0">
                    <p className="font-semibold text-snow">{agentName(snap.id)}</p>
                    <p className={snap.error ? "text-danger" : "text-fog"}>{snap.error ?? "Reading from NEAR testnet…"}</p>
                  </li>
                );
              }
              const state = agentState(data.status);
              const key = keyCheck(snap.id, data.agentKeys);
              const last = lastAgentActivity(data);
              return (
                <li key={snap.id} className="border-b border-edge last:border-0">
                  <a
                    href={href}
                    className={cx("grid grid-cols-2 items-center gap-x-3 gap-y-2 px-5 py-4 text-[13px] hover:bg-white/[0.03]", COLUMNS)}
                  >
                    <span className="col-span-2 min-w-0 lg:col-span-1">
                      <span className="block truncate text-[14px] font-semibold text-snow">{agentName(snap.id)}</span>
                      <span className="block truncate text-fog">{data.status.agent_id}</span>
                      {AGENT_NAMES[snap.id] && <span className="block truncate text-[12px] text-fog/80">{AGENT_NAMES[snap.id]?.note}</span>}
                    </span>
                    <span title={state.why}>
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </span>
                    <span title={key.detail}>
                      <Badge tone={key.tone}>{key.label}</Badge>
                    </span>
                    <span className="tabular text-mist">
                      <span className="text-fog lg:hidden">Per payment: </span>
                      {near(data.status.agent_max_per_payment)}
                      {data.status.frozen && <span className="block text-[12px] text-ice">On hold while frozen</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="tabular mb-1 block text-mist">
                        {near(data.status.spent_today)} <span className="text-fog">of {near(data.status.agent_daily_limit)}</span>
                      </span>
                      <Progress
                        value={nearFloat(data.status.spent_today)}
                        max={nearFloat(data.status.agent_daily_limit)}
                        tone="brand"
                      />
                    </span>
                    <span className="tabular">
                      <span className="text-[15px] font-semibold text-snow">{data.status.score}</span>
                      <span className="text-fog"> /100</span>
                    </span>
                    <span className="text-fog">{last ? ago(last) : "Never"}</span>
                    <ChevronRight size={15} className="hidden text-fog lg:block" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[13px] text-fog">
        Statuses: <strong className="text-mist">Active</strong> sends within its limits.{" "}
        <strong className="text-mist">Pending approval</strong> has payments waiting for you.{" "}
        <strong className="text-mist">Restricted</strong> is on probation (score under 20), so every payment needs you.{" "}
        <strong className="text-mist">Suspended</strong> means its vault is frozen.
      </p>
    </>
  );
}
