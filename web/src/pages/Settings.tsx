import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useNearWallet } from "near-connect-hooks";
import { useState, type FormEvent } from "react";
import { Badge, Button, Field, PageHeader, Panel, agentName, useToast } from "../components/ui";
import { DEFAULT_VAULTS, EXPLORER, NETWORK_LABEL, REFRESH_MS, RPC_URL } from "../config";
import { ago } from "../lib/format";
import { isAccountId } from "../lib/near";
import { useVaults } from "../lib/store";

const LOCAL_KEYS = ["phishbowl.vaults", "phishbowl.seen", "phishbowl.sidebar.collapsed"];

export function Settings() {
  const { watched, snapshots, addVault, removeVault, refresh } = useVaults();
  const { signedAccountId, signIn, signOut, loading } = useNearWallet();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const value = draft.trim().toLowerCase();
  const valid = isAccountId(value);
  const duplicate = watched.includes(value);

  function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!valid || duplicate) return;
    addVault(value);
    setDraft("");
    toast({ tone: "brand", text: `Watching ${value}. Reading it from ${NETWORK_LABEL}.` });
  }

  function resetDefaults() {
    for (const id of watched) if (!DEFAULT_VAULTS.includes(id)) removeVault(id);
    for (const id of DEFAULT_VAULTS) addVault(id);
    toast({ tone: "neutral", text: "Back to the default vault list." });
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
      <PageHeader title="Settings" description="Choose which vaults this dashboard watches. These settings stay in this browser." />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Watched vaults" description="Any Phishbowl vault on NEAR testnet. Watching is read-only and needs no wallet.">
          {watched.length === 0 ? (
            <p className="mb-4 text-[13px] text-fog">No vaults yet. Add one below.</p>
          ) : (
            <ul className="mb-4 divide-y divide-edge rounded-lg border border-edge">
              {watched.map((id) => {
                const snap = snapshots.find((s) => s.id === id);
                const owner = snap?.data?.status.owner_id;
                return (
                  <li key={id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-snow">{agentName(id)}</span>
                      <span className="block truncate text-[12px] text-fog">
                        {id}
                        {owner && signedAccountId === owner ? ", you own it" : ""}
                      </span>
                    </span>
                    {snap?.data ? (
                      <Badge tone="secure">Reading</Badge>
                    ) : snap?.error ? (
                      <Badge tone="danger">Can't read</Badge>
                    ) : (
                      <Badge tone="neutral">Loading</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Stop watching ${id}`}
                      onClick={() => {
                        removeVault(id);
                        toast({ tone: "neutral", text: `Stopped watching ${id}. Nothing changed on NEAR.` });
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                    {snap?.error && <p className="basis-full text-[12px] text-danger">{snap.error}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          <form onSubmit={onAdd} className="flex flex-wrap items-start gap-2">
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
              {duplicate && <span className="mt-1 block text-[12px] text-fog">Already watching it.</span>}
            </label>
            <Button type="submit" variant="primary" disabled={!valid || duplicate}>
              <Plus size={15} /> Watch vault
            </Button>
          </form>
          <button type="button" onClick={resetDefaults} className="mt-4 text-[13px] text-fog underline hover:text-snow">
            Reset to the default list
          </button>
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
            {signedAccountId ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 text-[13px]">
                  <span className="block text-fog">Connected as</span>
                  <span className="block truncate text-snow">{signedAccountId}</span>
                </p>
                <Button size="sm" onClick={() => void signOut()}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-fog">Connect a wallet to act as the owner of a vault.</p>
                <Button size="sm" variant="primary" disabled={loading} onClick={() => void signIn()}>
                  Connect wallet
                </Button>
              </div>
            )}
          </Panel>

          <Panel title="This browser">
            <p className="text-[13px] text-fog">
              Phishbowl itself keeps three things in this browser: the vaults you watch, which alerts you've read, and whether
              the sidebar is collapsed. Your wallet session is kept by NEAR Connect and your wallet, not by Phishbowl.
            </p>
            <Button className="mt-4" size="sm" variant="ghost" onClick={clearBrowser}>
              Clear saved settings
            </Button>
          </Panel>
        </div>
      </div>
    </>
  );
}
