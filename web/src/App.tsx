import { NearProvider } from "near-connect-hooks";
import { useEffect, useState } from "react";
import { NETWORK, vaultFromAddress } from "./config";
import { Dashboard } from "./Dashboard";
import { Footer, Header } from "./Header";
import { Home } from "./Home";

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const update = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const onVault = hash.startsWith("#/vault") || new URLSearchParams(window.location.search).has("vault");
  const vaultId = vaultFromAddress();

  return (
    <NearProvider config={{ network: NETWORK, features: { testnet: true } }}>
      <Header page={onVault ? "vault" : "home"} />
      {onVault ? <Dashboard key={vaultId} vaultId={vaultId} /> : <Home />}
      <Footer />
    </NearProvider>
  );
}
