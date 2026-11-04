export const NETWORK = "testnet" as const;
export const NETWORK_LABEL = "NEAR testnet";
export const RPC_URL = "https://test.rpc.fastnear.com";
/** Tried in order when the main RPC node refuses or is busy. */
export const RPC_FALLBACKS = ["https://rpc.testnet.near.org"];
export const EXPLORER = "https://testnet.nearblocks.io";
export const GITHUB_URL = "https://github.com/A-L-E-XX/NEARHAKATON";

/** Creates vaults for new users and records which wallet owns which vault. */
export const FACTORY_ID = "pb-factory.testnet";

/**
 * The read-only demo: the sample bakery's vault, the three model-league vaults
 * and the vault the automated tests froze. Set VITE_DEMO_VAULTS (comma
 * separated) when building to change them.
 */
export const DEMO_VAULTS: string[] = (
  import.meta.env.VITE_DEMO_VAULTS ||
  "wasback-vault.testnet,pb-league-deepseek.testnet,pb-league-qwen.testnet,pb-league-glm.testnet,phishbowl-ci-41456407509-1.testnet"
)
  .split(",")
  .map((id: string) => id.trim())
  .filter(Boolean);

/** Friendly names for known vaults. Anything else is shown by its account name. */
export const AGENT_NAMES: Record<string, { name: string; note: string }> = {
  "wasback-vault.testnet": {
    name: "Brightside Bakery agent",
    note: "Pays supplier invoices for the demo bakery. Owned by wasback.testnet.",
  },
  "pb-league-deepseek.testnet": {
    name: "League: DeepSeek V4.1 Flash",
    note: "Model league agent. Faces the same five drills as the other league agents.",
  },
  "pb-league-qwen.testnet": {
    name: "League: Qwen 3.8 27B",
    note: "Model league agent. Faces the same five drills as the other league agents.",
  },
  "pb-league-glm.testnet": {
    name: "League: GLM 5.3 Flash",
    note: "Model league agent. Faces the same five drills as the other league agents.",
  },
  "phishbowl-ci-41456407509-1.testnet": {
    name: "Test agent (CI)",
    note: "Created by GitHub Actions to check every contract change on testnet.",
  },
};

export const REFRESH_MS = 15_000;
