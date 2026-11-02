import {
  ArrowLeftRight,
  BrainCircuit,
  FileCode2,
  GitBranch,
  Globe,
  KeyRound,
  Link2,
  Radio,
  Server,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useNearWallet } from "near-connect-hooks";
import { useEffect, useState, type ReactNode } from "react";
import { Badge, Button, PageHeader, Panel } from "../components/ui";
import { EXPLORER, GITHUB_URL, NETWORK_LABEL, RPC_URL } from "../config";
import type { Tone } from "../lib/derive";
import { rpcHealth, type RpcHealth } from "../lib/near";
import { useVaults } from "../lib/store";

const AI_MEMO = /\| ai:([A-Za-z0-9_-]+)/;

function Row({
  icon: Icon,
  name,
  status,
  tone,
  children,
  detail,
  action,
}: {
  icon: LucideIcon;
  name: string;
  status: string;
  tone: Tone;
  children: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="grid gap-x-4 gap-y-2 border-b border-edge px-5 py-4 last:border-0 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]">
      <span className="hidden h-9 w-9 items-center justify-center rounded-lg border border-edge bg-raised text-water sm:flex">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-semibold text-snow">{name}</h3>
          <Badge tone={tone}>{status}</Badge>
        </div>
        <p className="mt-1 max-w-[72ch] text-[13px] text-fog">{children}</p>
        {detail && <p className="tabular mt-1.5 text-[12px] text-mist">{detail}</p>}
      </div>
      {action && <div className="self-center">{action}</div>}
    </li>
  );
}

function useRpcHealth(): { health: RpcHealth | null; failed: boolean } {
  const [health, setHealth] = useState<RpcHealth | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () =>
      rpcHealth()
        .then((result) => {
          if (!alive) return;
          setHealth(result);
          setFailed(false);
        })
        .catch(() => alive && setFailed(true));
    void check();
    const timer = window.setInterval(check, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);
  return { health, failed };
}

export function Integrations() {
  const { snapshots } = useVaults();
  const { signedAccountId, signIn, loading } = useNearWallet();
  const { health, failed } = useRpcHealth();

  const loaded = snapshots.filter((s) => s.data);
  const events = loaded.reduce((sum, s) => sum + (s.data?.activity.length ?? 0), 0);
  const aiTagged = loaded.reduce(
    (sum, s) =>
      sum +
      (s.data?.activity.filter((e) => (e.kind === "Sent" || e.kind === "Approved") && AI_MEMO.test(e.message)).length ?? 0) +
      (s.data?.pending.filter((p) => p.memo && AI_MEMO.test(p.memo)).length ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title="Integrations"
        description="What Phishbowl is connected to. Everything listed as live is working in this build; planned items aren't built yet."
      />

      <Panel bodyClassName="p-0" title="Live" description="Running on NEAR testnet now">
        <ul>
          <Row
            icon={Server}
            name="NEAR RPC"
            status={failed ? "Not reachable" : health ? "Connected" : "Checking"}
            tone={failed ? "danger" : health ? "secure" : "neutral"}
            detail={
              health
                ? `Block ${health.latestBlock.toLocaleString("en-US")} on ${health.chainId}, answered in ${health.ms} ms. ${RPC_URL}`
                : RPC_URL
            }
          >
            This site reads every vault straight from the chain with view calls. There's no Phishbowl server or database in
            between, so what you see is what the contract says.
          </Row>
          <Row
            icon={Wallet}
            name="NEAR Connect"
            status={signedAccountId ? "Connected" : "Ready"}
            tone={signedAccountId ? "secure" : "neutral"}
            detail={signedAccountId ? `Signed in as ${signedAccountId}` : "No wallet connected in this browser"}
            action={
              !signedAccountId && (
                <Button size="sm" disabled={loading} onClick={() => void signIn()}>
                  Connect wallet
                </Button>
              )
            }
          >
            Wallet sign-in for owners. Approving a payment, changing limits or unfreezing a vault is signed in your own NEAR
            wallet. This site never sees a private key.
          </Row>
          <Row
            icon={FileCode2}
            name="Phishbowl vault contract"
            status={loaded.length ? `${loaded.length} vault${loaded.length === 1 ? "" : "s"} live` : "No vaults"}
            tone={loaded.length ? "secure" : "neutral"}
            detail={`${events} decision${events === 1 ? "" : "s"} on record in the watched vaults`}
            action={
              <a className="text-[13px] text-water hover:underline" href={`${GITHUB_URL}/tree/main/contract`}>
                Source
              </a>
            }
          >
            A Rust smart contract (near-sdk 5) that holds the money and enforces the rules: scam drills, spending limits,
            approvals and freezes. Owner actions that loosen the rules need a 1 yoctoNEAR deposit, so only a full wallet
            signature can do them.
          </Row>
          <Row icon={Radio} name="NEP-297 events" status="Live" tone="secure" detail='Standard "drillvault", version 1.0.0'>
            Each decision is also logged as a standard NEAR event, so any indexer or bot can follow the vaults without
            trusting this site.
          </Row>
          <Row
            icon={KeyRound}
            name="Function-call access keys"
            status="Live"
            tone="secure"
            action={
              <a className="text-[13px] text-water hover:underline" href="#/wallet">
                Check keys
              </a>
            }
          >
            The agent's account should hold a key that can only call the vault, and only propose payments, report scams or
            freeze. The Wallet Security page reads the agent's real keys and warns if one has full access.
          </Row>
          <Row
            icon={BrainCircuit}
            name="NEAR AI Cloud"
            status="Used by the agent"
            tone="brand"
            detail={
              aiTagged
                ? `${aiTagged} payment${aiTagged === 1 ? "" : "s"} in the watched vaults carry a NEAR AI chat ID`
                : "No payment in the watched vaults carries a NEAR AI chat ID yet"
            }
            action={
              <a className="text-[13px] text-water hover:underline" href={`${GITHUB_URL}/tree/main/agent`}>
                Agent code
              </a>
            }
          >
            The sample bookkeeping agent asks a model on NEAR AI Cloud what to do with each invoice email. The model runs in a
            trusted execution environment, and the agent writes the chat ID into the payment note so the signed answer can be
            checked later.
          </Row>
          <Row
            icon={GitBranch}
            name="GitHub Actions on testnet"
            status="Live"
            tone="secure"
            action={
              <a className="text-[13px] text-water hover:underline" href={`${GITHUB_URL}/actions/workflows/contract.yml`}>
                Runs
              </a>
            }
          >
            Every contract change is tested, built, deployed to a fresh testnet account and put through a real scam drill.
            The test agent on this site is one of those vaults.
          </Row>
          <Row
            icon={Globe}
            name="NearBlocks"
            status="Linked"
            tone="neutral"
            action={
              <a className="text-[13px] text-water hover:underline" href={EXPLORER}>
                Open
              </a>
            }
          >
            Every account and payment on this site links to the {NETWORK_LABEL} explorer, so you can check it yourself.
          </Row>
        </ul>
      </Panel>

      <Panel className="mt-5" bodyClassName="p-0" title="Planned" description="Not built yet, and not claimed anywhere on this site">
        <ul>
          <Row icon={ArrowLeftRight} name="NEAR Intents" status="Planned" tone="neutral">
            Pay suppliers in stablecoins or other tokens, with the same drills and limits in front of every payment.
          </Row>
          <Row icon={Link2} name="Chain Signatures" status="Planned" tone="neutral">
            Let one vault pay on other chains while NEAR keeps the rules and the record.
          </Row>
          <Row icon={Zap} name="Meta transactions" status="Planned" tone="neutral">
            Let an agent ask for payments without holding NEAR for gas.
          </Row>
          <Row icon={Globe} name="NEAR mainnet" status="After the hackathon" tone="neutral">
            The contract runs on testnet until it has been reviewed. Nothing here moves real money.
          </Row>
        </ul>
      </Panel>
    </>
  );
}
