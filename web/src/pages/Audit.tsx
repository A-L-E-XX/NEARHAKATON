import { Download, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, Empty, PageHeader, Panel, agentName, cx } from "../components/ui";
import { KIND, actorOf, type Actor, type VaultSnapshot } from "../lib/derive";
import { dateTime, nearExact } from "../lib/format";
import type { Route } from "../lib/route";
import { useVaults } from "../lib/store";
import type { ActivityKind, VaultData } from "../lib/vault";

type Loaded = VaultSnapshot & { data: VaultData };
const ACTORS: Array<Actor | "All"> = ["All", "Agent", "Owner", "Vault", "Drill runner", "NEAR"];

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function Audit({ route }: { route: Route }) {
  const { snapshots } = useVaults();
  const loaded = snapshots.filter((s): s is Loaded => Boolean(s.data));
  const rows = loaded
    .flatMap((s) => s.data.activity.map((entry) => ({ ...entry, vaultId: s.id, actor: actorOf(entry) })))
    .sort((a, b) => b.at_ms - a.at_ms);

  const search = route.query.toString();
  const [text, setText] = useState(route.query.get("q") ?? "");
  const [actor, setActor] = useState<Actor | "All">("All");
  const [kind, setKind] = useState<ActivityKind | "All">("All");

  // Follow links like #/audit?q=refund from the search bar.
  useEffect(() => {
    setText(new URLSearchParams(search).get("q") ?? "");
  }, [search]);

  const q = text.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (actor === "All" || row.actor === actor) &&
      (kind === "All" || row.kind === kind) &&
      (!q || [row.message, row.receiver_id ?? "", row.vaultId].some((v) => v.toLowerCase().includes(q))),
  );

  function exportCsv() {
    const header = ["time_utc", "vault", "event_id", "actor", "event", "account", "amount_near", "score_change", "record"];
    const lines = shown.map((row) =>
      [
        new Date(row.at_ms).toISOString(),
        row.vaultId,
        String(row.id),
        row.actor,
        row.kind,
        row.receiver_id ?? "",
        row.amount ? nearExact(row.amount) : "",
        String(row.score_change),
        row.message,
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `phishbowl-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const select = "h-8 rounded-lg border border-edge bg-raised px-2 text-[13px] text-snow";

  return (
    <>
      <PageHeader
        title="Security Audit"
        description="Every decision the vaults made, written by the vault contract on NEAR and also emitted as a NEP-297 event. Only the contract can add to it."
        actions={
          <Button size="sm" onClick={exportCsv} disabled={!shown.length}>
            <Download size={14} /> Export CSV
          </Button>
        }
      />
      <Panel
        bodyClassName="p-0"
        title={`${shown.length} record${shown.length === 1 ? "" : "s"}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select className={select} value={actor} onChange={(e) => setActor(e.target.value as Actor | "All")} aria-label="Actor">
              {ACTORS.map((a) => (
                <option key={a} value={a}>
                  {a === "All" ? "Everyone" : a}
                </option>
              ))}
            </select>
            <select className={select} value={kind} onChange={(e) => setKind(e.target.value as ActivityKind | "All")} aria-label="Event type">
              <option value="All">All events</option>
              {(Object.keys(KIND) as ActivityKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND[k].label}
                </option>
              ))}
            </select>
            <label className="relative">
              <span className="sr-only">Search the audit log</span>
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fog" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Search"
                className="h-8 w-44 rounded-lg border border-edge bg-raised pl-8 pr-2 text-[13px] focus:border-water/60 focus:outline-none"
              />
            </label>
          </div>
        }
      >
        {shown.length === 0 ? (
          <div className="p-5">
            <Empty title={rows.length ? "No records match these filters." : "No records yet."} />
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[8.5rem_6.5rem_9rem_minmax(0,1fr)_3rem] gap-4 border-b border-edge px-5 py-2.5 text-[12px] text-fog lg:grid">
              <span>Time</span>
              <span>Actor</span>
              <span>Event</span>
              <span>Record</span>
              <span className="text-right">Score</span>
            </div>
            <ul>
              {shown.map((row) => (
                <li
                  key={`${row.vaultId}:${row.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5 border-b border-edge px-5 py-3 text-[13px] last:border-0 lg:grid-cols-[8.5rem_6.5rem_9rem_minmax(0,1fr)_3rem]"
                >
                  <span className="tabular order-2 text-right text-[12px] text-fog lg:order-none lg:text-left lg:text-[13px]">
                    {dateTime(row.at_ms)}
                  </span>
                  <span className="order-4 text-[12px] text-fog lg:order-none lg:text-[13px] lg:text-mist">{row.actor}</span>
                  <span className="order-1 lg:order-none">
                    <Badge tone={KIND[row.kind].tone}>{KIND[row.kind].label}</Badge>
                  </span>
                  <span className="order-3 col-span-2 min-w-0 lg:order-none lg:col-span-1">
                    <span className="block break-words text-snow">{row.message}</span>
                    <span className="block text-[12px] text-fog">
                      {agentName(row.vaultId)}, event #{row.id}
                    </span>
                  </span>
                  <span
                    className={cx(
                      "tabular order-5 text-right font-semibold lg:order-none",
                      row.score_change > 0 ? "text-secure" : row.score_change < 0 ? "text-danger" : "text-fog",
                    )}
                  >
                    {row.score_change > 0 ? `+${row.score_change}` : row.score_change < 0 ? `−${-row.score_change}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
      <p className="mt-4 max-w-[80ch] text-[13px] text-fog">
        Each vault keeps its latest 100 records in contract storage to keep storage costs bounded. Older records aren't
        lost: every one was also logged as an event in a NEAR transaction, which anyone can check on NearBlocks.
      </p>
    </>
  );
}
