import type { ReactNode } from "react";
import { useSelectedVault, useVaults } from "../lib/store";
import type { VaultData } from "../lib/vault";
import { Empty, ErrorNote, Loading } from "./ui";

/** Shows loading, error and empty states, and only renders children once the selected vault has data. */
export function VaultGate({ children }: { children: (vaultId: string, data: VaultData) => ReactNode }) {
  const { watched } = useVaults();
  const snapshot = useSelectedVault();
  if (!watched.length || !snapshot) {
    return (
      <Empty title="No vaults to watch yet">
        Add a vault on the <a className="underline" href="#/settings">Settings</a> page, or follow{" "}
        <a className="underline" href="#/start">Get started</a> to create one for your agent.
      </Empty>
    );
  }
  if (!snapshot.data) {
    return snapshot.error ? <ErrorNote>{snapshot.error}</ErrorNote> : <Loading />;
  }
  return <>{children(snapshot.id, snapshot.data)}</>;
}
