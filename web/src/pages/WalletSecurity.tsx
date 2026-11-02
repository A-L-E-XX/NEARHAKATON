import { Lock, Snowflake, Trash2 } from "lucide-react";
import { useNearWallet } from "near-connect-hooks";
import { useState } from "react";
import { ONE_YOCTO, OwnerAction } from "../components/OwnerAction";
import { VaultGate } from "../components/VaultGate";
import { Badge, Button, Field, PageHeader, Panel, VaultPicker } from "../components/ui";
import { NETWORK_LABEL } from "../config";
import { keyCheck } from "../lib/derive";
import { near, shortKey, toYocto } from "../lib/format";
import { isAccountId } from "../lib/near";
import type { VaultData } from "../lib/vault";

export function WalletSecurity() {
  return (
    <>
      <PageHeader
        title="Wallet Security"
        description="Who is connected, who owns the vault, and who can sign what. Phishbowl never asks for or shows private keys or seed phrases."
        actions={<VaultPicker />}
      />
      <VaultGate>{(vaultId, data) => <Body vaultId={vaultId} data={data} />}</VaultGate>
    </>
  );
}

function Body({ vaultId, data }: { vaultId: string; data: VaultData }) {
  const { signedAccountId, signIn } = useNearWallet();
  const { status, lists } = data;
  const isOwner = signedAccountId !== "" && signedAccountId === status.owner_id;
  const key = keyCheck(vaultId, data.agentKeys);

  return (
    <div className="space-y-5">
      <div className="grid gap-px overflow-hidden rounded-xl border border-edge bg-edge md:grid-cols-3">
        <div className="bg-panel p-5">
          <p className="text-[13px] text-fog">Connected wallet</p>
          <p className="mt-1 truncate text-[15px] font-semibold">{signedAccountId || "Not connected"}</p>
          <p className="mt-2 text-[13px] text-fog">
            Connecting only tells this site your account name. It gives the site no power over your money.
          </p>
          {!signedAccountId && (
            <Button className="mt-3" size="sm" variant="primary" onClick={() => void signIn()}>
              Connect wallet
            </Button>
          )}
        </div>
        <div className="bg-panel p-5">
          <p className="text-[13px] text-fog">Vault owner</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] font-semibold">
            <span className="truncate">{status.owner_id}</span>
            {isOwner && <Badge tone="secure">That's you</Badge>}
          </p>
          <p className="mt-2 text-[13px] text-fog">
            Only the owner can approve payments, unfreeze the vault, change limits and withdraw money.
          </p>
        </div>
        <div className="bg-panel p-5">
          <p className="text-[13px] text-fog">Agent's signing key</p>
          <p className="mt-1">
            <Badge tone={key.tone}>{key.label}</Badge>
          </p>
          <p className="mt-2 text-[13px] text-fog">{key.detail}</p>
        </div>
      </div>

      <Panel title="Who can sign what" description="Enforced by the vault contract on NEAR, not by this website">
        <ul className="divide-y divide-edge text-[13px]">
          <Authority who={`Owner wallet (${status.owner_id})`} can="Approve payments, withdraw, unfreeze, change limits, allow or unblock accounts" note="Each of these needs a wallet confirmation with 1 yoctoNEAR attached." tone="secure" />
          <Authority who={`Agent (${status.agent_id})`} can="Ask to pay, report a scam, freeze the vault" note="It can never send money directly, approve its own payments or loosen any rule." tone="brand" />
          <Authority who={`Drill operator (${status.drill_operator_id})`} can="Start scam drills" note="It can't touch money. The agent can't run its own drills." tone="neutral" />
          <Authority who="A website login key" can="Freeze, reject a payment, block an account" note="Anything that loosens the rules is refused without the full wallet's confirmation." tone="neutral" />
        </ul>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Vault funds and emergency controls">
          <dl>
            <Field label="Spendable" value={near(status.available_balance)} mono />
            <Field label="State" value={status.frozen ? <Badge tone="ice">Frozen</Badge> : <Badge tone="secure">Active</Badge>} />
            <Field label="Network" value={NETWORK_LABEL} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {status.frozen ? (
              <OwnerAction
                vaultId={vaultId}
                ownerId={status.owner_id}
                method="unfreeze"
                deposit={ONE_YOCTO}
                variant="primary"
                label="Unfreeze vault"
                confirmTitle="Unfreeze the vault"
                confirmText="The agent can send payments within its limits again."
                confirmLabel="Unfreeze vault"
                done="Vault unfrozen."
              />
            ) : (
              <OwnerAction
                vaultId={vaultId}
                ownerId={status.owner_id}
                method="freeze"
                args={{ reason: "Frozen from Wallet Security" }}
                variant="ice"
                label={
                  <>
                    <Snowflake size={15} /> Freeze vault
                  </>
                }
                confirmTitle="Freeze the vault"
                confirmText="Nothing can be sent until you unfreeze it."
                confirmLabel="Freeze vault"
                done="Vault frozen."
              />
            )}
          </div>
          <Withdraw vaultId={vaultId} ownerId={status.owner_id} />
        </Panel>

        <Panel title="Agent account keys" description={`Keys on ${status.agent_id}, read live from NEAR`}>
          {data.agentKeys === null ? (
            <p className="text-[13px] text-fog">Couldn't read the keys.</p>
          ) : (
            <ul className="space-y-2.5 text-[13px]">
              {data.agentKeys.map((k) => (
                <li key={k.publicKey} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="tabular block text-snow">{shortKey(k.publicKey)}</span>
                    <span className="block text-fog">
                      {k.kind === "full" ? "Full access to the agent's account" : `Only ${k.methods.join(", ") || "any method"} on ${k.receiver}`}
                    </span>
                  </span>
                  <Badge tone={k.kind === "full" ? "danger" : "secure"}>{k.kind === "full" ? "Full" : "Limited"}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 flex items-start gap-2 text-[12px] text-fog">
            <Lock size={13} className="mt-0.5 shrink-0" />
            Phishbowl only reads public keys. Private keys stay in your wallet and on the agent's machine.
          </p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AccountList
          title="Approved recipients"
          description={
            status.policy.allowlist_only
              ? "Allowlist-only mode is on: the agent can only pay these accounts without approval."
              : "Allowlist-only mode is off, so the agent can pay any account within its limits. Turn it on in Spending Controls."
          }
          accounts={lists.allowlist}
          empty="No approved recipients yet."
          vaultId={vaultId}
          ownerId={status.owner_id}
          add={{ method: "allow", deposit: ONE_YOCTO, label: "Approve", done: "Recipient approved." }}
          remove={{ method: "disallow", deposit: "0", label: "Remove", done: "Recipient removed." }}
        />
        <AccountList
          title="Blocked recipients"
          description="Payments to these accounts are refused, and the agent loses 15 points for trying."
          accounts={lists.blocklist}
          empty="No blocked accounts."
          vaultId={vaultId}
          ownerId={status.owner_id}
          add={{ method: "block", deposit: "0", label: "Block", done: "Account blocked." }}
          remove={{ method: "unblock", deposit: ONE_YOCTO, label: "Unblock", done: "Account unblocked." }}
        />
      </div>

      <Panel title="Supported networks">
        <ul className="space-y-2 text-[13px]">
          <li className="flex items-center justify-between gap-3">
            <span>NEAR testnet</span>
            <Badge tone="secure">Live</Badge>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>NEAR mainnet</span>
            <Badge tone="neutral">After the hackathon</Badge>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Ethereum, Base, Solana and others through NEAR Chain Signatures</span>
            <Badge tone="neutral">Planned</Badge>
          </li>
        </ul>
      </Panel>
    </div>
  );
}

function Authority({ who, can, note, tone }: { who: string; can: string; note: string; tone: "secure" | "brand" | "neutral" }) {
  return (
    <li className="grid gap-1 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-6">
      <span className="flex items-center gap-2 font-semibold text-snow">
        <Badge tone={tone}>{tone === "secure" ? "Owner" : tone === "brand" ? "Agent" : "Limited"}</Badge>
        <span className="min-w-0 truncate">{who}</span>
      </span>
      <span>
        <span className="block text-mist">{can}</span>
        <span className="block text-fog">{note}</span>
      </span>
    </li>
  );
}

interface ListAction {
  method: string;
  deposit: string;
  label: string;
  done: string;
}

function AccountList({
  title,
  description,
  accounts,
  empty,
  vaultId,
  ownerId,
  add,
  remove,
}: {
  title: string;
  description: string;
  accounts: string[];
  empty: string;
  vaultId: string;
  ownerId: string;
  add: ListAction;
  remove: ListAction;
}) {
  const [draft, setDraft] = useState("");
  const value = draft.trim();
  const valid = isAccountId(value);
  return (
    <Panel title={title} description={description}>
      {accounts.length === 0 ? (
        <p className="text-[13px] text-fog">{empty}</p>
      ) : (
        <ul className="divide-y divide-edge rounded-lg border border-edge">
          {accounts.map((account) => (
            <li key={account} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
              <span className="min-w-0 truncate">{account}</span>
              <OwnerAction
                vaultId={vaultId}
                ownerId={ownerId}
                method={remove.method}
                args={{ account_id: account }}
                deposit={remove.deposit}
                variant="ghost"
                size="sm"
                label={
                  <>
                    <Trash2 size={13} /> {remove.label}
                  </>
                }
                confirmTitle={`${remove.label} ${account}`}
                confirmText={`${remove.label} ${account} in ${vaultId}.`}
                confirmLabel={remove.label}
                done={remove.done}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="account.testnet"
          spellCheck={false}
          autoCapitalize="none"
          aria-label={`Account to ${add.label.toLowerCase()}`}
          className="h-9 min-w-0 flex-1 rounded-lg border border-edge bg-raised px-3 text-sm placeholder:text-fog/70 focus:border-water/60 focus:outline-none"
        />
        <OwnerAction
          vaultId={vaultId}
          ownerId={ownerId}
          method={add.method}
          args={{ account_id: value }}
          deposit={add.deposit}
          size="sm"
          disabled={!valid}
          label={add.label}
          confirmTitle={`${add.label} ${value}`}
          confirmText={`${add.label} ${value} in ${vaultId}.`}
          confirmLabel={add.label}
          done={add.done}
        />
      </div>
      {value && !valid && <p className="mt-2 text-[12px] text-caution">That isn't a valid NEAR account name.</p>}
    </Panel>
  );
}

function Withdraw({ vaultId, ownerId }: { vaultId: string; ownerId: string }) {
  const [amount, setAmount] = useState("");
  const yocto = toYocto(amount);
  return (
    <div className="mt-5 border-t border-edge pt-4">
      <p className="text-[13px] font-semibold">Withdraw to the owner</p>
      <div className="mt-2 flex gap-2">
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Amount in NEAR"
          inputMode="decimal"
          aria-label="Amount to withdraw in NEAR"
          className="h-9 min-w-0 flex-1 rounded-lg border border-edge bg-raised px-3 text-sm placeholder:text-fog/70 focus:border-water/60 focus:outline-none"
        />
        <OwnerAction
          vaultId={vaultId}
          ownerId={ownerId}
          method="withdraw"
          args={{ amount: yocto ?? "0" }}
          deposit={ONE_YOCTO}
          size="sm"
          disabled={!yocto || yocto === "0"}
          label="Withdraw"
          confirmTitle="Withdraw from the vault"
          confirmText={`${amount} NEAR goes from the vault to ${ownerId}.`}
          confirmLabel="Withdraw"
          done="Withdrawal sent."
        />
      </div>
    </div>
  );
}
