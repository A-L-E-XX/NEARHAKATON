import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { STATE_TONE, TxTable } from "../components/TxTable";
import { PageHeader, Panel, TONE_DOT, cx } from "../components/ui";
import { transactionsFor, type TxState, type VaultSnapshot } from "../lib/derive";
import type { Route } from "../lib/route";
import { useVaults } from "../lib/store";
import type { VaultData } from "../lib/vault";

const STATES: Array<TxState | "All"> = ["All", "Pending", "Completed", "Approved", "Rejected", "Blocked", "Failed"];
type Loaded = VaultSnapshot & { data: VaultData };

function stateFrom(value: string | null): TxState | "All" {
  return value && (STATES as string[]).includes(value) ? (value as TxState) : "All";
}

export function Transactions({ route }: { route: Route }) {
  const { snapshots } = useVaults();
  const loaded = snapshots.filter((s): s is Loaded => Boolean(s.data));
  const all = loaded.flatMap((s) => transactionsFor(s.id, s.data)).sort((a, b) => b.at - a.at);
  const search = route.query.toString();
  const [state, setState] = useState<TxState | "All">(() => stateFrom(route.query.get("state")));
  const [text, setText] = useState(route.query.get("q") ?? "");

  // Follow links like #/transactions?q=account or ?state=Pending, including from the search bar.
  useEffect(() => {
    const params = new URLSearchParams(search);
    setText(params.get("q") ?? "");
    setState(stateFrom(params.get("state")));
  }, [search]);

  const q = text.trim().toLowerCase();
  const shown = all.filter(
    (tx) =>
      (state === "All" || tx.state === state) &&
      (!q || [tx.to ?? "", tx.vaultId, tx.agentId, tx.decision, tx.message].some((v) => v.toLowerCase().includes(q))),
  );
  const count = (s: TxState | "All") => (s === "All" ? all.length : all.filter((tx) => tx.state === s).length);

  return (
    <>
      <PageHeader
        title="Transaction Monitor"
        description="Every payment the agents asked for and what the vault decided. Open one to see the full record or approve it."
      />
      <Panel
        bodyClassName="p-0"
        title={
          <div className="flex flex-wrap gap-1">
            {STATES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setState(s)}
                aria-pressed={state === s}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-normal",
                  state === s ? "bg-white/[0.08] text-snow" : "text-fog hover:text-snow",
                )}
              >
                {s !== "All" && <span className={cx("h-1.5 w-1.5 rounded-full", TONE_DOT[STATE_TONE[s]])} />}
                {s}
                <span className="tabular text-fog">{count(s)}</span>
              </button>
            ))}
          </div>
        }
        action={
          <label className="relative">
            <span className="sr-only">Search transactions</span>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fog" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Account, agent or text"
              className="h-8 w-56 rounded-lg border border-edge bg-raised pl-8 pr-2 text-[13px] focus:border-water/60 focus:outline-none"
            />
          </label>
        }
      >
        <div className="pt-3">
          <TxTable
            txs={shown}
            ownerOf={(vaultId) => loaded.find((s) => s.id === vaultId)?.data.status.owner_id ?? ""}
            emptyText={all.length ? "No payments match these filters." : "No payments yet."}
          />
        </div>
      </Panel>
      <p className="mt-4 text-[13px] text-fog">
        The list comes from each vault's on-chain activity log, which keeps the latest 100 events. Every older transaction is
        still on NEAR and can be found on NearBlocks.
      </p>
    </>
  );
}
