import { useNearWallet } from "near-connect-hooks";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEMO_VAULTS, FACTORY_ID, REFRESH_MS } from "../config";
import type { VaultSnapshot } from "./derive";
import { explainNearError, view } from "./near";
import { readVault } from "./vault";

/**
 * Who is looking decides what is shown:
 *   welcome - no wallet connected: the welcome page, nothing else
 *   demo    - the labelled, read-only demo (the sample bakery and the model league)
 *   mine    - a connected wallet: only the vaults that wallet owns
 */
export type Mode = "welcome" | "demo" | "mine";

const DEMO_KEY = "phishbowl.demo";
const EXTRA_KEY = "phishbowl.extra-vaults";

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable (private mode). The choice just won't survive a reload.
  }
}

function readExtras(): Record<string, string[]> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(EXTRA_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

function writeExtras(extras: Record<string, string[]>): void {
  try {
    window.localStorage.setItem(EXTRA_KEY, JSON.stringify(extras));
  } catch {
    // Not fatal.
  }
}

interface Store {
  mode: Mode;
  /** The connected wallet, if any. */
  account: string | null;
  /** True while the wallet connection is being restored on page load. */
  walletLoading: boolean;
  /** The vaults shown in the current mode. */
  watched: string[];
  snapshots: VaultSnapshot[];
  firstLoad: boolean;
  /** True once the factory has said which vaults the connected wallet owns. */
  ownedKnown: boolean;
  selectedId: string;
  select: (id: string) => void;
  enterDemo: () => void;
  exitDemo: () => void;
  /** Add a vault the connected wallet owns but the factory doesn't know about. */
  addVault: (id: string) => void;
  removeVault: (id: string) => void;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function VaultsProvider({ children }: { children: ReactNode }) {
  const { signedAccountId, loading: walletLoading } = useNearWallet();
  const account = signedAccountId || null;
  // Never wait on the wallet for long: after 3 seconds, show the page anyway.
  const [waitedEnough, setWaitedEnough] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaitedEnough(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  const [demo, setDemo] = useState<boolean>(() => readFlag(DEMO_KEY));
  const [factoryVaults, setFactoryVaults] = useState<string[]>([]);
  const [ownedKnown, setOwnedKnown] = useState(false);
  const [extras, setExtras] = useState<Record<string, string[]>>(readExtras);

  const mode: Mode = demo ? "demo" : account ? "mine" : "welcome";

  const watched = useMemo(() => {
    if (mode === "demo") return DEMO_VAULTS;
    if (mode === "mine" && account) return [...new Set([...factoryVaults, ...(extras[account] ?? [])])];
    return [];
  }, [mode, account, factoryVaults, extras]);

  const [snapshots, setSnapshots] = useState<VaultSnapshot[]>([]);
  const [firstLoad, setFirstLoad] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const watchedRef = useRef(watched);
  watchedRef.current = watched;
  const accountRef = useRef(account);
  accountRef.current = account;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  /** Ask the factory which vaults this wallet owns. */
  const loadOwned = useCallback(async () => {
    const who = accountRef.current;
    if (!who) return;
    try {
      const ids = await view<string[]>(FACTORY_ID, "get_vaults", { owner_id: who });
      if (accountRef.current === who) setFactoryVaults(ids);
    } catch {
      // Keep whatever we knew; the next refresh tries again.
    } finally {
      if (accountRef.current === who) setOwnedKnown(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (modeRef.current === "mine") await loadOwned();
    const ids = watchedRef.current;
    const who = accountRef.current;
    const results = await Promise.all(
      ids.map(async (id): Promise<VaultSnapshot> => {
        try {
          return { id, data: await readVault(id), updatedAt: Date.now() };
        } catch (err) {
          return { id, error: explainNearError(err, id), updatedAt: Date.now() };
        }
      }),
    );
    setSnapshots((previous) =>
      results
        .map((next) => {
          // Keep the last good data if a refresh fails, so the screen doesn't empty out.
          const before = previous.find((p) => p.id === next.id);
          return next.error && before?.data ? { ...before, error: next.error } : next;
        })
        // In your own space, only vaults you own are shown.
        .filter((s) => modeRef.current !== "mine" || !s.data || s.data.status.owner_id === who),
    );
    setFirstLoad(false);
  }, [loadOwned]);

  // A new wallet (or none): forget the previous wallet's vaults.
  useEffect(() => {
    setFactoryVaults([]);
    setOwnedKnown(false);
    setSnapshots([]);
    setFirstLoad(true);
    if (account) void loadOwned();
  }, [account, loadOwned]);

  useEffect(() => {
    if (mode === "welcome") return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh, watched, mode]);

  const enterDemo = useCallback(() => {
    writeFlag(DEMO_KEY, true);
    setSnapshots([]);
    setFirstLoad(true);
    setDemo(true);
  }, []);

  const exitDemo = useCallback(() => {
    writeFlag(DEMO_KEY, false);
    setSnapshots([]);
    setFirstLoad(true);
    setDemo(false);
  }, []);

  const addVault = useCallback(
    (id: string) => {
      const clean = id.trim().toLowerCase();
      if (!clean || !account) return;
      setExtras((current) => {
        const list = current[account] ?? [];
        if (list.includes(clean)) return current;
        const next = { ...current, [account]: [...list, clean] };
        writeExtras(next);
        return next;
      });
      setSelectedId(clean);
    },
    [account],
  );

  const removeVault = useCallback(
    (id: string) => {
      if (!account) return;
      setExtras((current) => {
        const next = { ...current, [account]: (current[account] ?? []).filter((v) => v !== id) };
        writeExtras(next);
        return next;
      });
      setSnapshots((current) => current.filter((s) => s.id !== id));
    },
    [account],
  );

  const shown = snapshots.filter((s) => watched.includes(s.id));
  const visibleIds = shown.length ? shown.map((s) => s.id) : watched;

  const value = useMemo<Store>(
    () => ({
      mode,
      account,
      walletLoading: Boolean(walletLoading) && !waitedEnough,
      watched: visibleIds,
      snapshots: shown,
      firstLoad,
      ownedKnown,
      selectedId: visibleIds.includes(selectedId) ? selectedId : visibleIds[0] ?? "",
      select: setSelectedId,
      enterDemo,
      exitDemo,
      addVault,
      removeVault,
      refresh,
    }),
    [mode, account, walletLoading, waitedEnough, visibleIds.join(","), shown, firstLoad, ownedKnown, selectedId, enterDemo, exitDemo, addVault, removeVault, refresh],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useVaults(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useVaults must be used inside VaultsProvider");
  return store;
}

/** The vault the current page is about (picked in the vault switcher). */
export function useSelectedVault(): VaultSnapshot | undefined {
  const { snapshots, selectedId } = useVaults();
  return snapshots.find((s) => s.id === selectedId) ?? snapshots[0];
}
