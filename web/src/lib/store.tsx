import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_VAULTS, REFRESH_MS } from "../config";
import type { VaultSnapshot } from "./derive";
import { explainNearError } from "./near";
import { readVault } from "./vault";

const STORAGE_KEY = "phishbowl.vaults";

function loadWatched(): string[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string") && parsed.length) {
      return parsed as string[];
    }
  } catch {
    // Storage can be unavailable (private mode, embedded views). Fall back to the defaults.
  }
  return DEFAULT_VAULTS;
}

function saveWatched(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Not fatal: the list just won't survive a reload.
  }
}

interface Store {
  watched: string[];
  snapshots: VaultSnapshot[];
  firstLoad: boolean;
  selectedId: string;
  select: (id: string) => void;
  addVault: (id: string) => void;
  removeVault: (id: string) => void;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function VaultsProvider({ children }: { children: ReactNode }) {
  const [watched, setWatched] = useState<string[]>(loadWatched);
  const [snapshots, setSnapshots] = useState<VaultSnapshot[]>(() => watched.map((id) => ({ id })));
  const [firstLoad, setFirstLoad] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(() => watched[0] ?? "");
  const watchedRef = useRef(watched);
  watchedRef.current = watched;

  const refresh = useCallback(async () => {
    const ids = watchedRef.current;
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
      results.map((next) => {
        // Keep the last good data if a refresh fails, so the screen doesn't empty out.
        const before = previous.find((p) => p.id === next.id);
        return next.error && before?.data ? { ...before, error: next.error } : next;
      }),
    );
    setFirstLoad(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh, watched]);

  const addVault = useCallback((id: string) => {
    const clean = id.trim().toLowerCase();
    if (!clean) return;
    setWatched((current) => {
      if (current.includes(clean)) return current;
      const next = [...current, clean];
      saveWatched(next);
      return next;
    });
    setSnapshots((current) => (current.some((s) => s.id === clean) ? current : [...current, { id: clean }]));
    setSelectedId(clean);
  }, []);

  const removeVault = useCallback((id: string) => {
    setWatched((current) => {
      const next = current.filter((v) => v !== id);
      saveWatched(next);
      return next;
    });
    setSnapshots((current) => current.filter((s) => s.id !== id));
    setSelectedId((current) => (current === id ? "" : current));
  }, []);

  const value = useMemo<Store>(
    () => ({
      watched,
      snapshots,
      firstLoad,
      selectedId: watched.includes(selectedId) ? selectedId : watched[0] ?? "",
      select: setSelectedId,
      addVault,
      removeVault,
      refresh,
    }),
    [watched, snapshots, firstLoad, selectedId, addVault, removeVault, refresh],
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
