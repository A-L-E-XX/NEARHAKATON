import { Bot, KeyRound } from "lucide-react";
import { useNearWallet } from "near-connect-hooks";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Badge, Button, PageHeader, Panel, cx, useToast } from "../components/ui";
import { FACTORY_ID, NETWORK_LABEL } from "../config";
import { near, toYocto } from "../lib/format";
import { go } from "../lib/route";
import { view, viewAccount } from "../lib/near";
import { useVaults } from "../lib/store";

const GAS = "300000000000000"; // 300 Tgas: two new accounts, the vault's setup and the factory's bookkeeping

interface Terms {
  cost: string;
  first_vault_free: boolean;
  sponsored_available: boolean;
}

/** Mirrors the factory's rules, so mistakes show before the wallet opens. */
function nameProblem(name: string): string | null {
  if (!name) return null;
  if (name.length < 2 || name.length > 32) return "Use 2 to 32 characters.";
  if (!/^[a-z0-9-]+$/.test(name)) return "Use only lowercase letters, digits and hyphens.";
  if (name.startsWith("-") || name.endsWith("-") || name.includes("--")) return "Hyphens can't be at the start or end, or doubled.";
  if (name.endsWith("-agent")) return "The name can't end in -agent.";
  return null;
}

async function exists(accountId: string): Promise<boolean> {
  try {
    await viewAccount(accountId);
    return true;
  } catch {
    return false;
  }
}

function Choice({
  checked,
  onSelect,
  icon,
  title,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer gap-3 rounded-lg border p-4",
        checked ? "border-water/60 bg-water/[0.06]" : "border-edge bg-raised hover:border-fog/60",
      )}
    >
      <input type="radio" className="mt-1 accent-[#3cc4bc]" checked={checked} onChange={onSelect} />
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-snow">
          {icon}
          {title}
        </span>
        <span className="mt-1 block text-[13px] text-fog">{children}</span>
      </span>
    </label>
  );
}

export function CreateVault({ first = false }: { first?: boolean }) {
  const { callFunction } = useNearWallet();
  const { account, refresh } = useVaults();
  const toast = useToast();
  const [name, setName] = useState("");
  const [agentMode, setAgentMode] = useState<"demo" | "own">("demo");
  const [publicKey, setPublicKey] = useState("");
  const [perPayment, setPerPayment] = useState("2");
  const [perDay, setPerDay] = useState("10");
  const [taken, setTaken] = useState<boolean | null>(null);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const problem = nameProblem(name);
  const vaultId = `${name}.${FACTORY_ID}`;

  useEffect(() => {
    if (!account) return;
    view<Terms>(FACTORY_ID, "get_terms", { owner_id: account }).then(setTerms).catch(() => setTerms(null));
    viewAccount(account)
      .then((info) => setBalance(info.amount))
      .catch(() => setBalance(null));
  }, [account]);

  // Check the names are free, a moment after typing stops.
  useEffect(() => {
    setTaken(null);
    if (!name || problem) return;
    const timer = window.setTimeout(async () => {
      const [vault, agent] = await Promise.all([exists(vaultId), exists(`${name}-agent.${FACTORY_ID}`)]);
      setTaken(vault || agent);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [name, problem, vaultId]);

  const perPaymentYocto = toYocto(perPayment);
  const perDayYocto = toYocto(perDay);
  const limitsProblem =
    !perPaymentYocto || !perDayYocto || perPaymentYocto === "0"
      ? "Enter both limits as plain amounts, like 2 or 0.5."
      : BigInt(perPaymentYocto) > BigInt(perDayYocto)
        ? "The per-payment limit can't be more than the daily limit."
        : null;
  const keyProblem =
    agentMode === "own" && !/^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(publicKey.trim())
      ? "Paste your agent's public key. It starts with ed25519: (never paste a private key)."
      : null;
  const free = terms ? terms.first_vault_free && terms.sponsored_available : false;
  const deposit = terms && !free ? terms.cost : "0";
  const lowBalance = balance !== null && BigInt(balance) < BigInt(deposit) + 50_000_000_000_000_000_000_000n; // fee buffer: 0.05 NEAR
  const ready = Boolean(name) && !problem && taken === false && !limitsProblem && !keyProblem && !busy;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !account) return;
    setBusy(true);
    const args: Record<string, unknown> = {
      name,
      policy: { max_per_payment: perPaymentYocto, daily_limit: perDayYocto, max_requests_per_day: 50, allowlist_only: false },
    };
    if (agentMode === "own") args.agent_public_key = publicKey.trim();
    try {
      await callFunction({ contractId: FACTORY_ID, method: "create_vault", args, deposit, gas: GAS });
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      toast({ tone: "danger", text: /reject|denied|cancel/i.test(text) ? "Cancelled in your wallet." : `Not created: ${text.slice(0, 160)}` });
      setBusy(false);
      return;
    }
    // The wallet may answer before NEAR has finished, so ask the factory itself.
    let owned: string[] = [];
    for (let attempt = 0; attempt < 6 && !owned.includes(vaultId); attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      owned = await view<string[]>(FACTORY_ID, "get_vaults", { owner_id: account }).catch(() => []);
    }
    setBusy(false);
    if (owned.includes(vaultId)) {
      toast({ tone: "secure", text: `Your vault ${vaultId} is ready.` });
      await refresh();
      go("overview");
    } else {
      toast({ tone: "danger", text: "The vault wasn't created. The name may have just been taken; try another." });
    }
  }

  const field = "h-10 w-full rounded-lg border border-edge bg-raised px-3 text-sm text-snow focus:border-water/60 focus:outline-none";

  return (
    <>
      <PageHeader
        title={first ? "Create your first vault" : "Create a vault"}
        description={
          first
            ? `${account} doesn't own a vault yet. Make one in a minute: your agent gets its own account whose only key can call this vault, and you stay the only one who can approve, unfreeze or change limits.`
            : "Each vault has its own agent, limits and scam-drill record."
        }
      />
      <form onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel title="Name">
            <label className="block text-[13px] text-fog" htmlFor="vault-name">
              Vault name
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id="vault-name"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase())}
                placeholder="my-bakery"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={field}
              />
            </div>
            <p className="mt-2 break-all text-[13px] text-fog">
              {name ? (
                <>
                  Vault <span className="text-snow">{vaultId}</span>, agent{" "}
                  <span className="text-snow">{`${name}-agent.${FACTORY_ID}`}</span>
                </>
              ) : (
                `Your vault becomes <name>.${FACTORY_ID}, and its agent <name>-agent.${FACTORY_ID}.`
              )}
            </p>
            {problem && <p className="mt-1 text-[13px] text-caution">{problem}</p>}
            {!problem && taken === true && <p className="mt-1 text-[13px] text-caution">That name is taken. Try another.</p>}
            {!problem && taken === false && <p className="mt-1 text-[13px] text-secure">Available.</p>}
          </Panel>

          <Panel title="Agent" description="Who will ask this vault for payments">
            <div className="grid gap-3">
              <Choice
                checked={agentMode === "demo"}
                onSelect={() => setAgentMode("demo")}
                icon={<Bot size={16} className="text-water" />}
                title="Phishbowl's demo agent"
              >
                Try everything straight away. Phishbowl's test agent asks this vault for payments and faces scam drills,
                so you can approve, reject and freeze from your wallet. You can switch to your own agent later.
              </Choice>
              <Choice
                checked={agentMode === "own"}
                onSelect={() => setAgentMode("own")}
                icon={<KeyRound size={16} className="text-water" />}
                title="My own agent"
              >
                Your agent generates a key pair on its own machine and gives you only the public half. Its account here
                gets that key, limited to this vault.
              </Choice>
            </div>
            {agentMode === "own" && (
              <div className="mt-4">
                <label className="block text-[13px] text-fog" htmlFor="agent-key">
                  Agent's public key
                </label>
                <input
                  id="agent-key"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="ed25519:..."
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={cx(field, "mt-1.5")}
                />
                {publicKey && keyProblem && <p className="mt-1 text-[13px] text-caution">{keyProblem}</p>}
              </div>
            )}
          </Panel>

          <Panel title="Limits" description="The most the agent could ever spend without you. Its score sets how much of this it gets.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[13px] text-fog">
                Most per payment (NEAR)
                <input value={perPayment} onChange={(e) => setPerPayment(e.target.value)} inputMode="decimal" className={cx(field, "mt-1.5")} />
              </label>
              <label className="block text-[13px] text-fog">
                Most per day (NEAR)
                <input value={perDay} onChange={(e) => setPerDay(e.target.value)} inputMode="decimal" className={cx(field, "mt-1.5")} />
              </label>
            </div>
            {limitsProblem ? (
              <p className="mt-2 text-[13px] text-caution">{limitsProblem}</p>
            ) : (
              <p className="mt-2 text-[13px] text-fog">
                New agents start at score 30, so at first it can send {near(perPaymentYocto ? (BigInt(perPaymentYocto) * 30n / 100n).toString() : "0")} per payment
                and {near(perDayYocto ? (BigInt(perDayYocto) * 30n / 100n).toString() : "0")} a day. Anything bigger waits for you.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Summary">
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-fog">Owner</dt>
                <dd className="truncate text-snow">{account}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fog">Cost</dt>
                <dd>
                  {terms === null ? (
                    <span className="text-fog">Checking</span>
                  ) : free ? (
                    <Badge tone="secure">Free, your first vault</Badge>
                  ) : (
                    <span className="tabular text-snow">{near(terms.cost)}</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fog">Vault starts with</dt>
                <dd className="text-snow">About 1 NEAR to pay with</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fog">Your wallet</dt>
                <dd className="tabular text-snow">{balance === null ? "Checking" : near(balance)}</dd>
              </div>
            </dl>
            {lowBalance && (
              <p className="mt-4 rounded-lg border border-caution/30 bg-caution/10 px-3 py-2 text-[13px] text-caution">
                Your wallet needs a little {NETWORK_LABEL} NEAR{free ? " for the network fee (about 0.01 NEAR)" : " to pay for this vault"}. Testnet NEAR
                is free from a faucet.
              </p>
            )}
            <Button type="submit" variant="primary" className="mt-5 w-full" disabled={!ready}>
              {busy ? "Waiting for your wallet and NEAR" : "Create vault"}
            </Button>
            <p className="mt-3 text-[12px] text-fog">
              Your wallet will show the call to {FACTORY_ID} before anything happens. The factory makes the two accounts
              and records that you own the vault.
            </p>
          </Panel>
        </div>
      </form>
    </>
  );
}
