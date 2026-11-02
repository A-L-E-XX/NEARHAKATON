import { useNearWallet } from "near-connect-hooks";
import { useState, type FormEvent } from "react";
import { Bowl } from "./Bowl";
import { EXPLORER } from "./config";
import { ACTIVITY, DRILL, TIER_HELP, drillOutcome } from "./labels";
import { near, useVault, when } from "./vault";

const GAS_SIMPLE = "30000000000000"; // 30 Tgas
const GAS_TRANSFER = "100000000000000"; // 100 Tgas: the transfer plus its callback
const ONE_YOCTO = "1";

type Notice = { tone: "ok" | "error"; text: string } | null;

export function Dashboard({ vaultId }: { vaultId: string }) {
  const { data, error, refresh } = useVault(vaultId);
  const { signedAccountId, signIn, callFunction } = useNearWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function act(key: string, method: string, args: Record<string, unknown>, deposit: string, done: string, gas = GAS_SIMPLE) {
    setBusy(key);
    setNotice(null);
    try {
      await callFunction({ contractId: vaultId, method, args, deposit, gas });
      setNotice({ tone: "ok", text: done });
      await refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setNotice({ tone: "error", text: `That didn't go through: ${text.slice(0, 200)}` });
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <main className="page">
        <VaultHeading vaultId={vaultId} />
        <p className={error ? "notice notice--error" : "loading"}>{error ?? "Reading the vault from NEAR testnet."}</p>
      </main>
    );
  }

  const { status, drills, pending, activity, lists } = data;
  const isOwner = signedAccountId !== "" && signedAccountId === status.owner_id;
  const { stats } = status;

  return (
    <main className="page" data-ready="true">
      <VaultHeading vaultId={vaultId} />

      {status.frozen && (
        <div className="banner banner--ice" role="status">
          <p>
            <strong>Frozen.</strong> The agent can't send anything until the owner unfreezes the vault.
          </p>
          {isOwner && (
            <button
              className="btn btn--line"
              type="button"
              disabled={busy !== null}
              onClick={() => void act("unfreeze", "unfreeze", {}, ONE_YOCTO, "Vault unfrozen.")}
            >
              {busy === "unfreeze" ? "Waiting for your wallet" : "Unfreeze vault"}
            </button>
          )}
        </div>
      )}

      {notice && (
        <p className={`notice notice--${notice.tone}`} role="status">
          {notice.text}
        </p>
      )}

      <div className="dash">
        <aside className="dash__side">
          <div className="dash__bowl">
            <Bowl score={status.score} frozen={status.frozen} activeDrills={status.active_drills} size={220} />
          </div>
          <p className="score-line">
            Score <strong className="num">{status.score}</strong> out of 100, level {status.tier}.
          </p>
          <p className="hint">{TIER_HELP[status.tier]}</p>
          <dl className="facts">
            <div>
              <dt>Can send per payment</dt>
              <dd className="num">{near(status.agent_max_per_payment)}</dd>
            </div>
            <div>
              <dt>Can send per day</dt>
              <dd className="num">{near(status.agent_daily_limit)}</dd>
            </div>
            <div>
              <dt>Sent today</dt>
              <dd className="num">{near(status.spent_today)}</dd>
            </div>
            <div>
              <dt>Money in the vault</dt>
              <dd className="num">{near(status.available_balance)}</dd>
            </div>
          </dl>
          <p className="hint">
            At score 100 the agent could send {near(status.policy.max_per_payment)} per payment and{" "}
            {near(status.policy.daily_limit)} per day. Its score scales those limits.
          </p>

          <div className="owner">
            <h2 className="owner__title">Owner controls</h2>
            {isOwner ? (
              <>
                <p className="hint">You're signed in as the owner.</p>
                {!status.frozen && (
                  <button
                    className="btn btn--ice"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void act("freeze", "freeze", { reason: "Frozen from the dashboard" }, "0", "Vault frozen.")
                    }
                  >
                    {busy === "freeze" ? "Waiting for your wallet" : "Freeze vault"}
                  </button>
                )}
              </>
            ) : signedAccountId ? (
              <p className="hint">
                You're signed in as {signedAccountId}. Only the owner, {status.owner_id}, can approve payments or
                freeze and unfreeze this vault.
              </p>
            ) : (
              <>
                <p className="hint">Connect the owner's wallet to approve payments and freeze or unfreeze the vault.</p>
                <button className="btn btn--line" type="button" onClick={() => void signIn()}>
                  Connect wallet
                </button>
              </>
            )}
          </div>
        </aside>

        <div className="dash__main">
          <section aria-labelledby="waiting">
            <h2 id="waiting">Waiting for approval</h2>
            {pending.length === 0 ? (
              <p className="empty">Nothing is waiting. Payments above the agent's limits will show up here.</p>
            ) : (
              <ul className="rows">
                {pending.map((payment) => (
                  <li className="row row--pending" key={payment.id}>
                    <span className="row__when">{when(payment.created_at_ms)}</span>
                    <span className="row__what">
                      <strong>
                        {near(payment.amount)} to {payment.receiver_id}
                      </strong>
                      <span className="row__detail">Held because {payment.reasons.join("; ")}.</span>
                      {payment.memo && <span className="row__detail">Agent's note: {payment.memo}</span>}
                    </span>
                    {isOwner && (
                      <span className="row__actions">
                        <button
                          className="btn btn--small"
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            void act(
                              `approve-${payment.id}`,
                              "approve",
                              { request_id: payment.id },
                              ONE_YOCTO,
                              "Payment approved.",
                              GAS_TRANSFER,
                            )
                          }
                        >
                          {busy === `approve-${payment.id}` ? "Waiting" : "Approve"}
                        </button>
                        <button
                          className="btn btn--small btn--line"
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            void act(`reject-${payment.id}`, "reject", { request_id: payment.id }, "0", "Payment rejected.")
                          }
                        >
                          {busy === `reject-${payment.id}` ? "Waiting" : "Reject"}
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="drills">
            <h2 id="drills">Scam drills</h2>
            <p className="summary">
              {stats.drills_reported} passed, {stats.drills_failed} failed, {stats.drills_missed} missed
              {status.active_drills > 0 ? `, ${status.active_drills} running now` : ""}. Running drills stay hidden
              until they end.
            </p>
            {drills.length === 0 ? (
              <p className="empty">No drills have finished yet.</p>
            ) : (
              <ul className="rows">
                {drills.map((drill) => (
                  <li className="row" key={drill.id}>
                    <span className="row__when">{when(drill.started_at_ms)}</span>
                    <span className="row__what">
                      <strong>{drill.lure}</strong>
                      <span className="row__detail">{drillOutcome(drill.status, drill.decoy_id)}</span>
                    </span>
                    <span className={`tag tag--${DRILL[drill.status].tone}`}>{DRILL[drill.status].label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="activity">
            <h2 id="activity">Everything the vault decided</h2>
            {activity.length === 0 ? (
              <p className="empty">Nothing yet. Every payment, block and drill will be listed here.</p>
            ) : (
              <ul className="rows">
                {activity.map((entry) => (
                  <li className="row" key={entry.id}>
                    <span className="row__when">{when(entry.at_ms)}</span>
                    <span className="row__what">
                      <span className={`tag tag--${ACTIVITY[entry.kind].tone}`}>{ACTIVITY[entry.kind].label}</span>
                      <span className="row__detail">{entry.message}</span>
                    </span>
                    <span
                      className={`row__points num ${
                        entry.score_change > 0 ? "points--up" : entry.score_change < 0 ? "points--down" : ""
                      }`}
                    >
                      {entry.score_change > 0 ? `+${entry.score_change}` : entry.score_change < 0 ? `−${-entry.score_change}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="accounts">
            <h2 id="accounts">Accounts</h2>
            <dl className="lists">
              <div>
                <dt>Allowed</dt>
                <dd>{lists.allowlist.length ? lists.allowlist.join(", ") : "None. Any account can be paid within the limits."}</dd>
              </div>
              <div>
                <dt>Blocked</dt>
                <dd>{lists.blocklist.length ? lists.blocklist.join(", ") : "None yet."}</dd>
              </div>
              <div>
                <dt>Reported by the agent</dt>
                <dd>{lists.reported.length ? lists.reported.join(", ") : "None waiting for review."}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}

function VaultHeading({ vaultId }: { vaultId: string }) {
  const [draft, setDraft] = useState(vaultId);

  function open(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (next) window.location.hash = `#/vault/${encodeURIComponent(next)}`;
  }

  return (
    <div className="dash__head">
      <div>
        <h1>Vault</h1>
        <p className="vault-id">
          <a href={`${EXPLORER}/address/${vaultId}`}>{vaultId}</a> on NEAR testnet
        </p>
      </div>
      <form className="vault-switch" onSubmit={open}>
        <label htmlFor="vault-input">Look at another vault</label>
        <div className="vault-switch__row">
          <input
            id="vault-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            autoCapitalize="none"
          />
          <button className="btn btn--small btn--line" type="submit">
            Show vault
          </button>
        </div>
      </form>
    </div>
  );
}
