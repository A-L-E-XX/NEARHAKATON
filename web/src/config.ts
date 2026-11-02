export const NETWORK = "testnet" as const;
export const RPC_URL = "https://test.rpc.fastnear.com";
export const EXPLORER = "https://testnet.nearblocks.io";
export const GITHUB_URL = "https://github.com/A-L-E-XX/NEARHAKATON";

/**
 * The vault the site shows by default. Set VITE_VAULT_ID when building, or add
 * ?vault=<account> to the address to look at any other Phishbowl vault.
 */
export const DEFAULT_VAULT_ID: string =
  import.meta.env.VITE_VAULT_ID || "phishbowl-ci-41456407509-1.testnet";

export function vaultFromAddress(): string {
  const fromQuery = new URLSearchParams(window.location.search).get("vault");
  const fromHash = window.location.hash.match(/^#\/vault\/([^/?#]+)/)?.[1];
  return decodeURIComponent(fromHash ?? fromQuery ?? DEFAULT_VAULT_ID);
}
