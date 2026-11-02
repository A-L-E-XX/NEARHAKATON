import { ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { EXPLORER, NETWORK_LABEL } from "../config";
import { SEVERITY_TONE, type Tone, type Tx, type TxState } from "../lib/derive";
import { dateTime, near } from "../lib/format";
import { GAS_TRANSFER, ONE_YOCTO, OwnerAction } from "./OwnerAction";
import { Badge, Drawer, Empty, Field, agentName, cx } from "./ui";

export const STATE_TONE: Record<TxState, Tone> = {
  Pending: "caution",
  Completed: "secure",
  Approved: "secure",
  Rejected: "neutral",
  Blocked: "danger",
  Failed: "danger",
};

const RISK_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low" } as const;

export function TxTable({
  txs,
  ownerOf,
  showAgent = true,
  emptyText = "No payments match.",
}: {
  txs: Tx[];
  ownerOf: (vaultId: string) => string;
  showAgent?: boolean;
  emptyText?: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = txs.find((tx) => tx.key === openKey) ?? null;

  if (!txs.length) {
    return <Empty title={emptyText} />;
  }

  return (
    <>
      <div className="hidden grid-cols-[6.5rem_7rem_minmax(0,1.4fr)_minmax(0,1fr)_7rem_5.5rem_8.5rem_1rem] gap-3 border-b border-edge px-5 pb-2.5 text-[12px] text-fog lg:grid">
        <span>Event</span>
        <span>Status</span>
        <span>To</span>
        <span>{showAgent ? "Agent" : "Decision"}</span>
        <span className="text-right">Amount</span>
        <span>Risk</span>
        <span>Time</span>
        <span />
      </div>
      <ul>
        {txs.map((tx) => (
          <li key={tx.key}>
            <button
              type="button"
              onClick={() => setOpenKey(tx.key)}
              className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-edge px-5 py-3 text-left text-[13px] last:border-0 hover:bg-white/[0.03] lg:grid-cols-[6.5rem_7rem_minmax(0,1.4fr)_minmax(0,1fr)_7rem_5.5rem_8.5rem_1rem]"
            >
              <span className="tabular hidden text-fog lg:block">
                {tx.pendingId !== undefined ? `Request ${tx.pendingId}` : `#${tx.eventId}`}
              </span>
              <span className="order-2 lg:order-none">
                <Badge tone={STATE_TONE[tx.state]}>{tx.state}</Badge>
              </span>
              <span className="order-1 min-w-0 truncate text-snow lg:order-none">{tx.to ?? "—"}</span>
              <span className="order-3 col-span-2 min-w-0 truncate text-fog lg:order-none lg:col-span-1">
                {showAgent ? agentName(tx.vaultId) : tx.decision}
              </span>
              <span className="tabular order-4 text-mist lg:order-none lg:text-right">{tx.amount ? near(tx.amount) : "—"}</span>
              <span className="order-5 hidden lg:order-none lg:block">
                {tx.risk ? <Badge tone={SEVERITY_TONE[tx.risk]}>{RISK_LABEL[tx.risk]}</Badge> : <span className="text-fog">None</span>}
              </span>
              <span className="order-6 text-right text-[12px] text-fog lg:order-none lg:text-left">{dateTime(tx.at)}</span>
              <ChevronRight size={15} className="hidden text-fog lg:block" />
            </button>
          </li>
        ))}
      </ul>

      <Drawer open={open !== null} onClose={() => setOpenKey(null)} title="Payment details">
        {open && <TxDetails tx={open} ownerId={ownerOf(open.vaultId)} />}
      </Drawer>
    </>
  );
}

function TxDetails({ tx, ownerId }: { tx: Tx; ownerId: string }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={STATE_TONE[tx.state]}>{tx.state}</Badge>
        {tx.risk && <Badge tone={SEVERITY_TONE[tx.risk]}>{RISK_LABEL[tx.risk]} risk</Badge>}
      </div>
      <p className="mb-4 text-[14px] text-snow">{tx.decision}</p>
      <dl>
        <Field label="Event" value={tx.pendingId !== undefined ? `Waiting request ${tx.pendingId}` : `Vault event #${tx.eventId}`} />
        <Field label="From (vault)" value={tx.vaultId} />
        <Field
          label="To"
          value={
            tx.to ? (
              <a className="inline-flex items-center gap-1 text-water hover:underline" href={`${EXPLORER}/address/${tx.to}`}>
                {tx.to}
                <ExternalLink size={12} />
              </a>
            ) : (
              "—"
            )
          }
        />
        <Field label="Agent" value={`${agentName(tx.vaultId)} (${tx.agentId})`} />
        <Field label="Asset and amount" value={tx.amount ? near(tx.amount, 6) : "—"} mono />
        <Field label="Network" value={NETWORK_LABEL} />
        <Field label="Time" value={dateTime(tx.at)} />
        {tx.reasons && <Field label="Why it was held" value={tx.reasons.join("; ")} />}
        {tx.memo && <Field label="Agent's note" value={tx.memo} />}
        {!tx.reasons && tx.message && <Field label="Vault's record" value={tx.message} />}
      </dl>

      {tx.state === "Pending" && tx.pendingId !== undefined && (
        <div className="mt-5 flex flex-wrap gap-2">
          <OwnerAction
            vaultId={tx.vaultId}
            ownerId={ownerId}
            method="approve"
            args={{ request_id: tx.pendingId }}
            deposit={ONE_YOCTO}
            gas={GAS_TRANSFER}
            variant="primary"
            label="Approve and send"
            confirmTitle="Approve this payment"
            confirmText={`The vault will send ${tx.amount ? near(tx.amount) : "the amount"} to ${tx.to}. This can't be undone.`}
            confirmLabel="Approve and send"
            done="Payment approved and sent."
          />
          <OwnerAction
            vaultId={tx.vaultId}
            ownerId={ownerId}
            method="reject"
            args={{ request_id: tx.pendingId }}
            variant="secondary"
            label="Reject"
            confirmTitle="Reject this payment"
            confirmText="Nothing will be sent, and the agent loses 5 points for asking."
            confirmLabel="Reject payment"
            done="Payment rejected."
          />
        </div>
      )}

      <a
        className={cx("mt-6 inline-flex items-center gap-1.5 text-[13px] text-water hover:underline")}
        href={`${EXPLORER}/address/${tx.vaultId}`}
      >
        See the vault's transactions on NearBlocks
        <ExternalLink size={12} />
      </a>
    </div>
  );
}
