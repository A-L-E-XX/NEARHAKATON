import { NearProvider } from "near-connect-hooks";
import { Shell } from "./components/Shell";
import { ToastProvider } from "./components/ui";
import { NETWORK } from "./config";
import { useRoute, type Route } from "./lib/route";
import { VaultsProvider } from "./lib/store";
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
  }
}

export function App() {
  const route = useRoute();
  return (
    <NearProvider config={{ network: NETWORK, features: { testnet: true } }}>
      <ToastProvider>
        <VaultsProvider>
          <Shell route={route}>
            <Page route={route} />
          </Shell>
        </VaultsProvider>
      </ToastProvider>
    </NearProvider>
  );
}
