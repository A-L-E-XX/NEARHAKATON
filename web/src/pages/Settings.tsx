import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useNearWallet } from "near-connect-hooks";
import { useState, type FormEvent } from "react";
import { Badge, Button, Field, PageHeader, Panel, agentName, useToast } from "../components/ui";
import { EXPLORER, FACTORY_ID, NETWORK_LABEL, REFRESH_MS, RPC_URL } from "../config";
import { ago } from "../lib/format";
import { isAccountId, view } from "../lib/near";
import { useVaults } from "../lib/store";

const LOCAL_KEYS = ["phishbowl.demo", "phishbowl.extra-vaults", "phishbowl.seen", "phishbowl.sidebar.collapsed"];

export function Settings() {
  const { mode, account, watched, snapshots, addVault, removeVault, refresh } = useVaults();
  const { signIn, signOut, loading } = useNearWallet();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const value = draft.trim().toLowerCase();
  const valid = isAccountId(value);
  const duplicate = watched.includes(value);

  // A vault made outside the factory (for example with NEAR CLI) can be added,
  // but only if this wallet really owns it.
  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!valid || duplicate || !account) return;
    setChecking(true);
    try {
      const status = await view<{ owner_id: string }>(value, "get_status");
      if (status.owner_id !== account) {
        toast({ tone: "caution", text: `${value} belongs to ${status.owner_id}, not to you.` });
      } else {
        addVault(value);
        setDraft("");
        toast({ tone: "brand", text: `Added ${value}.` });
      }
    } catch {
      toast({ tone: "danger", text: `${value} isn't a Phishbowl vault on ${NETWORK_LABEL}.` });
    }
    setChecking(false);
  }

  function clearBrowser() {
    try {
      for (const key of LOCAL_KEYS) window.localStorage.removeItem(key);
      toast({ tone: "neutral", text: "Cleared. Reload the page to start fresh." });
    } catch {
      toast({ tone: "caution", text: "This browser didn't allow it." });
    }
  }

  return (
    <>
      <PageHeader title="Settings" description={mode === "demo" ? "You're viewing the demo." : `Signed in as ${account}.`} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel
          title={mode === "demo" ? "Vaults in the demo" : "Your vaults"}
          description={
            mode === "demo"
              ? "Sample vaults on NEAR testnet. You can look at everything; only their owners can act."
              : `Vaults ${account} owns, found through the Phishbowl factory (${FACTORY_ID}).`
          }
        >
          {watched.length === 0 ? (
            <p className="mb-4 text-[13px] text-fog">
              No vaults yet.{" "}
              <a className="text-water underline" href="#/create">
                Create one
              </a>
              .
            </p>
          ) : (
            <ul className="mb-4 divide-y divide-edge rounded-lg border border-edge">
              {watched.map((id) => {
                const snap = snapshots.find((s) => s.id === id);
                return (
                  <li key={id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-snow">{agentName(id)}</span>
                      <span className="block truncate text-[12px] text-fog">{id}</span>
                    </span>
                    {snap?.data ? (
                      <Badge tone="secure">Reading</Badge>
                    ) : snap?.error ? (
                      <Badge tone="danger">Can't read</Badge>
                    ) : (
                      <Badge tone="neutral">Loading</Badge>
                    )}
                    {mode === "mine" && !id.endsWith(`.${FACTORY_ID}`) && (
                      <Button variant="ghost" size="sm" aria-label={`Remove ${id} from this list`} onClick={() => removeVault(id)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                    {snap?.error && <p className="basis-full text-[12px] text-danger">{snap.error}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          {mode === "mine" && (
            <form onSubmit={onAdd}>
              <p className="mb-2 text-[13px] text-fog">Made a vault some other way, such as with NEAR CLI? Add it here.</p>
              <div className="flex flex-wrap items-start gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Vault account</span>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="vault-name.testnet"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-10 w-full rounded-lg border border-edge bg-raised px-3 text-sm focus:border-water/60 focus:outline-none"
                  />
                  {value && !valid && <span className="mt-1 block text-[12px] text-caution">That isn't a valid NEAR account name.</span>}
                  {duplicate && <span className="mt-1 block text-[12px] text-fog">Already in your list.</span>}
                </label>
                <Button type="submit" disabled={!valid || duplicate || checking}>
                  <Plus size={15} /> {checking ? "Checking" : "Add"}
                </Button>
              </div>
            </form>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Data">
            <dl>
              <Field label="Network" value={NETWORK_LABEL} />
              <Field label="RPC node" value={RPC_URL} />
              <Field label="Explorer" value={EXPLORER} />
              <Field label="Refreshes" value={`Every ${REFRESH_MS / 1000} seconds`} />
              <Field
                label="Last read"
                value={(() => {
                  const times = snapshots.map((s) => s.updatedAt ?? 0).filter(Boolean);
                  return times.length ? ago(Math.max(...times)) : "Not yet";
                })()}
              />
            </dl>
            <Button
              className="mt-4"
              size="sm"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                await refresh();
                setRefreshing(false);
              }}
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} /> Refresh now
            </Button>
            <p className="mt-4 text-[13px] text-fog">
              There's no mock data. Every number comes from the vault contracts on NEAR. The only made-up part is the demo
              business: Brightside Bakery and its suppliers are sample data.
            </p>
          </Panel>

          <Panel title="Wallet">
            {account ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 text-[13px]">
                  <span className="block text-fog">Connected as</span>
                  <span className="block truncate text-snow">{account}</span>
                </p>
                <Button size="sm" onClick={() => void signOut()}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-fog">Connect a wallet to see and manage your own vaults.</p>
                <Button size="sm" variant="primary" disabled={loading} onClick={() => void signIn()}>
                  Connect wallet
                </Button>
              </div>
            )}
          </Panel>

          <Panel title="This browser">
            <p className="text-[13px] text-fog">
              Phishbowl itself keeps a few things in this browser: whether you're in the demo, vaults you added by hand,
              which alerts you've read, and whether the sidebar is collapsed. Your wallet session is kept by NEAR Connect
              and your wallet, not by Phishbowl.
            </p>
            <Button className="mt-4" size="sm" onClick={clearBrowser}>
              Clear saved settings
            </Button>
          </Panel>
        </div>
      </div>
    </>
  );
}
