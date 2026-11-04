import { Check } from "lucide-react";
import { useNearWallet } from "near-connect-hooks";
import type { ReactNode } from "react";
import { Badge, Button, PageHeader, Panel, cx } from "../components/ui";
import { GITHUB_URL, NETWORK_LABEL } from "../config";
import { keyCheck } from "../lib/derive";
import { useVaults } from "../lib/store";

type StepState = "done" | "todo";

function Step({ n, title, state, children, action }: { n: number; title: string; state: StepState; children: ReactNode; action?: ReactNode }) {
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
  const { signIn, loading } = useNearWallet();
  const { mode, account, snapshots } = useVaults();
  const mine = mode === "mine" ? snapshots.find((s) => s.data) : undefined;
  const key = mine?.data ? keyCheck(mine.id, mine.data.agentKeys) : null;
  const link = "text-[13px] text-water hover:underline";

  return (
    <>
      <PageHeader
        title="Get started"
        description={`Put an AI agent behind a Phishbowl vault on ${NETWORK_LABEL}. Ticks appear as each step is seen on chain.`}
      />
      <Panel bodyClassName="p-0">
        <ol>
          <Step
            n={1}
            title="Connect your NEAR wallet"
            state={account ? "done" : "todo"}
            action={
              !account && (
                <Button variant="primary" size="sm" disabled={loading} onClick={() => void signIn()}>
                  Connect wallet
                </Button>
              )
            }
          >
            <p>
              This is the owner: the only account that can approve held payments, change limits or unfreeze the vault. Use
              a testnet wallet such as Meteor or Intear.
            </p>
          </Step>

          <Step
            n={2}
            title="Create a vault"
            state={mine ? "done" : "todo"}
            action={
              account && !mine && (
                <a className={link} href="#/create">
                  Create a vault
                </a>
              )
            }
          >
            <p>
              The factory makes two accounts: the vault, which holds the money and enforces the rules, and an account for
              your agent. Your first vault is free and starts with about 1 NEAR to pay with.
            </p>
            {mine && <p className="text-mist">Your vault: {mine.id}.</p>}
          </Step>

          <Step n={3} title="The agent gets a limited key" state={key?.tone === "secure" ? "done" : "todo"}>
            <p>
              The agent's account has one key, and it can only ask this vault to pay, report a scam or freeze. It can't
              move NEAR on its own, so a tricked or hacked agent can't empty anything.
            </p>
            {key && key.tone !== "secure" && <p className="text-caution">{key.detail}</p>}
          </Step>

          <Step
            n={4}
            title="Set the limits"
            state={mine ? "done" : "todo"}
            action={
              mine && (
                <a className={link} href="#/spending">
                  Open Spending Controls
                </a>
              )
            }
          >
            <p>
              You chose the most the agent could ever spend. A new agent starts at score 30, so it gets 30% of that until it
              earns more by spotting scams. Anything bigger waits for you.
            </p>
          </Step>

          <Step
            n={5}
            title="Scam drills"
            state={mine?.data && mine.data.status.stats.drills_started > 0 ? "done" : "todo"}
            action={
              <a className={link} href={`${GITHUB_URL}#run-your-own-vault`}>
                Running your own drills
              </a>
            }
          >
            <p>
              Phishbowl runs the drills: it slips a fake scam into the agent's inbox and gives the vault only a fingerprint
              of the fake account. Report it and the score goes up. Try to pay it and nothing is sent, the vault freezes,
              and you decide when to unfreeze.
            </p>
          </Step>
        </ol>
      </Panel>
    </>
  );
}
