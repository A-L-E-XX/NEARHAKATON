import { NearProvider } from "near-connect-hooks";
import { Shell } from "./components/Shell";
import { ToastProvider } from "./components/ui";
import { NETWORK } from "./config";
import { useRoute, type Route } from "./lib/route";
import { VaultsProvider, useVaults } from "./lib/store";
import { CreateVault } from "./pages/CreateVault";
import { Welcome } from "./pages/Welcome";
import { AgentDetail } from "./pages/AgentDetail";
import { Agents } from "./pages/Agents";
import { Audit } from "./pages/Audit";
import { Integrations } from "./pages/Integrations";
import { Overview } from "./pages/Overview";
import { Reputation } from "./pages/Reputation";
import { Settings } from "./pages/Settings";
import { SpendingControls } from "./pages/SpendingControls";
import { Start } from "./pages/Start";
import { Threats } from "./pages/Threats";
import { Transactions } from "./pages/Transactions";
import { WalletSecurity } from "./pages/WalletSecurity";

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "overview":
      return <Overview />;
    case "agents":
      return <Agents />;
    case "agent":
      return <AgentDetail key={route.param} vaultId={route.param ?? ""} />;
    case "wallet":
      return <WalletSecurity />;
    case "spending":
      return <SpendingControls />;
    case "threats":
      return <Threats />;
    case "reputation":
      return <Reputation />;
    case "transactions":
      return <Transactions route={route} />;
    case "audit":
      return <Audit route={route} />;
    case "integrations":
      return <Integrations />;
    case "settings":
      return <Settings />;
    case "start":
      return <Start />;
    case "create":
      return <CreateVault />;
  }
}

/** Pages that make sense before you own a vault. */
const WITHOUT_VAULT = new Set(["create", "start", "settings", "integrations"]);

function Root({ route }: { route: Route }) {
  const { mode, walletLoading, ownedKnown, watched } = useVaults();
  if (mode === "welcome") {
    if (walletLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center text-sm text-fog" role="status">
          <span className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-water" />
          Checking your wallet
        </div>
      );
    }
    return <Welcome />;
  }
  const noVaultYet = mode === "mine" && ownedKnown && watched.length === 0;
  return (
    <Shell route={route}>
      {noVaultYet && !WITHOUT_VAULT.has(route.page) ? <CreateVault first /> : <Page route={route} />}
    </Shell>
  );
}

export function App() {
  const route = useRoute();
  return (
    <NearProvider config={{ network: NETWORK, features: { testnet: true } }}>
      <ToastProvider>
        <VaultsProvider>
          <Root route={route} />
        </VaultsProvider>
      </ToastProvider>
    </NearProvider>
  );
}
