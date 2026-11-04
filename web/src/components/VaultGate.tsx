import type { ReactNode } from "react";
import { useSelectedVault, useVaults } from "../lib/store";
import type { VaultData } from "../lib/vault";
import { Empty, ErrorNote, Loading } from "./ui";

/** Shows loading, error and empty states, and only renders children once the selected vault has data. */
export function VaultGate({ children }: { children: (vaultId: string, data: VaultData) => ReactNode }) {
  const { watched, firstLoad } = useVaults();
  const snapshot = useSelectedVault();
  if (!watched.length && !firstLoad) {
    return (
      <Empty title="No vault yet">
        <a className="underline" href="#/create">Create a vault</a> for your agent. It takes a minute, and your first one is free.
      </Empty>
    );
  }
  if (!snapshot) return <Loading />;
  if (!snapshot.data) {
    return snapshot.error ? <ErrorNote>{snapshot.error}</ErrorNote> : <Loading />;
  }
  return <>{children(snapshot.id, snapshot.data)}</>;
}
