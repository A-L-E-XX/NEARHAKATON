import { Check } from "lucide-react";
import { useNearWallet } from "near-connect-hooks";
import { useState, type FormEvent, type ReactNode } from "react";
import { Badge, Button, PageHeader, Panel, cx } from "../components/ui";
import { GITHUB_URL, NETWORK_LABEL } from "../config";
import { keyCheck } from "../lib/derive";
import { isAccountId } from "../lib/near";
import { useVaults } from "../lib/store";

type StepState = "done" | "todo" | "unknown";

function Step({
  n,
  title,
  state,
  children,
  action,
}: {
  n: number;
  title: string;
  state: StepState;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-4 border-b border-edge px-5 py-5 last:border-0">
      <span
        className={cx(
          "flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold",
          state === "done" ? "bg-secure/15 text-secure" : "border border-edge text-mist",
        )}
        aria-hidden="true"
      >
        {state === "done" ? <Check size={15} strokeWidth={2.6} /> : n}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-snow">{title}</h2>
          {state === "done" && <Badge tone="secure">Done</Badge>}
        </div>
        <div className="mt-1.5 max-w-[72ch] space-y-2 text-[13px] text-fog">{children}</div>
        {action && <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </li>
  );
}

export function Start() {
  const { signedAccountId, signIn, loading } = useNearWallet();
  const { snapshots, watched, addVault } = useVaults();
  const [draft, setDraft] = useState("");
  const value = draft.trim().toLowerCase();

  const mine = signedAccountId ? snapshots.find((s) => s.data?.status.owner_id === signedAccountId) : undefined;
  const key = mine?.data ? keyCheck(mine.id, mine.data.agentKeys) : null;

  function onWatch(event: FormEvent) {
    event.preventDefault();
    if (isAccountId(value) && !watched.includes(value)) {
      addVault(value);
      setDraft("");
    }
  }

  const link = "text-water hover:underline";

  return (
    <>
      <PageHeader
        title="Get started"
        description={`Put your own agent behind a Phishbowl vault on ${NETWORK_LABEL}. Ticks appear as this page sees each step done on chain.`}
      />
      <Panel bodyClassName="p-0">
        <ol>
          <Step
            n={1}
            title="Connect your NEAR wallet"
            state={signedAccountId ? "done" : "todo"}
            action={
              !signedAccountId && (
                <Button variant="primary" size="sm" disabled={loading} onClick={() => void signIn()}>
                  Connect wallet
                </Button>
              )
            }
          >
            <p>
              This is the owner account: the only one that can approve held payments, change limits, or unfreeze the vault.
              Use a testnet account; you can get free testnet NEAR from the faucet in most wallets.
            </p>
            {signedAccountId && <p className="text-mist">Connected as {signedAccountId}.</p>}
          </Step>

          <Step n={2} title="Create a vault for your agent" state={mine ? "done" : "todo"}>
            <p>
              The vault is its own NEAR account running the Phishbowl contract. You deploy it once, naming yourself as the
              owner and your agent's account as the agent, then send it the money the agent may spend.
            </p>
            <p>
              For now this is done with NEAR CLI, using the same commands the project's tests run on every change.{" "}
              <a className={link} href={`${GITHUB_URL}#run-your-own-vault`}>
                The commands are in the README.
              </a>
            </p>
            {mine && <p className="text-mist">Found your vault: {mine.id}.</p>}
          </Step>

          <Step
            n={3}
            title="Give the agent a limited key"
            state={key?.tone === "secure" ? "done" : mine ? "todo" : "unknown"}
            action={
              mine && (
                <a className={cx(link, "text-[13px]")} href="#/wallet">
                  Check the agent's keys
                </a>
              )
            }
          >
            <p>
              The agent signs with a function-call key that can only call your vault, and only to propose a payment, report a
              scam or freeze. Even if the agent is tricked or its key leaks, that key can't move NEAR on its own.
            </p>
            {key && key.tone !== "secure" && <p className="text-caution">{key.detail}</p>}
          </Step>

          <Step n={4} title="Watch the vault here" state={mine ? "done" : "todo"}>
            <p>Add the vault's account name. This dashboard only reads it, so no wallet is needed to watch.</p>
            {!mine && (
              <form onSubmit={onWatch} className="flex flex-wrap gap-2 pt-1">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="your-vault.testnet"
                  aria-label="Vault account"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-edge bg-raised px-3 text-sm text-snow focus:border-water/60 focus:outline-none"
                />
                <Button type="submit" size="sm" disabled={!isAccountId(value) || watched.includes(value)}>
                  Watch vault
                </Button>
              </form>
            )}
          </Step>

          <Step
            n={5}
            title="Set the agent's limits"
            state={mine ? "unknown" : "todo"}
            action={
              <a className={cx(link, "text-[13px]")} href="#/spending">
                Open Spending Controls
              </a>
            }
          >
            <p>
              New vaults allow 2 NEAR per payment and 10 NEAR a day. The agent gets its score as a percentage of these, so a
              new agent at 30 can send 0.6 NEAR per payment until it earns more. Anything above its limit waits for you.
            </p>
          </Step>

          <Step
            n={6}
            title="Run a scam drill"
            state={mine?.data && mine.data.status.stats.drills_started > 0 ? "done" : "todo"}
          >
            <p>
              The drill operator sends your agent a fake scam and registers only the hash of the decoy account with the
              vault, so the agent can't look it up. If the agent reports it, its score goes up. If it tries to pay, nothing
              is sent and the vault freezes.
            </p>
            <p>
              <a className={link} href={`${GITHUB_URL}#run-your-own-vault`}>
                How to start a drill
              </a>
            </p>
          </Step>
        </ol>
      </Panel>
    </>
  );
}
