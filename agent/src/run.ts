// Command line entry point: npm run agent -- [--brain nearai|naive|careful] [--dry-run]
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { processInbox } from "./agent.ts";
import { NearAiBrain, ScriptedBrain } from "./brain.ts";
import { loadInbox, loadSuppliers } from "./inbox.ts";
import type { Brain, StepResult, Vault } from "./types.ts";
import { DryRunVault, NearVault } from "./vault.ts";

const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V4.1-Flash-1017";
const DEFAULT_RPC = "https://test.rpc.fastnear.com";

const LABELS: Record<string, string> = {
  Sent: "PAID",
  Held: "HELD FOR OWNER",
  Blocked: "BLOCKED",
  DrillFailed: "DRILL FAILED",
  DrillPassed: "DRILL PASSED",
  Flagged: "REPORTED",
  AlreadyKnown: "ALREADY KNOWN",
  DryRun: "DRY RUN",
};

const { values } = parseArgs({
  options: {
    inbox: { type: "string", default: "demo/inbox" },
    suppliers: { type: "string", default: "demo/suppliers.json" },
    brain: { type: "string", default: "nearai" },
    "dry-run": { type: "boolean", default: false },
    out: { type: "string", default: "out" },
  },
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See agent/README.md for the settings the agent needs.`);
    process.exit(1);
  }
  return value;
}

function makeBrain(kind: string): Brain {
  if (kind === "naive" || kind === "careful") {
    return new ScriptedBrain(kind);
  }
  if (kind === "nearai") {
    return new NearAiBrain({
      apiKey: requireEnv("NEAR_AI_API_KEY"),
      model: process.env.NEAR_AI_MODEL ?? DEFAULT_MODEL,
      baseUrl: process.env.NEAR_AI_BASE_URL,
    });
  }
  console.error(`Unknown --brain "${kind}". Use nearai, naive or careful.`);
  process.exit(1);
}

function makeVault(dryRun: boolean): Vault {
  if (dryRun) {
    return new DryRunVault();
  }
  return new NearVault({
    rpcUrl: process.env.NEAR_RPC_URL ?? DEFAULT_RPC,
    vaultId: requireEnv("PHISHBOWL_VAULT_ID"),
    agentId: requireEnv("PHISHBOWL_AGENT_ID"),
    agentKey: requireEnv("PHISHBOWL_AGENT_KEY"),
  });
}

function label(step: StepResult): string {
  if (step.error) return "ERROR";
  if (!step.vault) return "SKIPPED";
  return LABELS[step.vault.outcome] ?? step.vault.outcome;
}

function describe(step: StepResult): string {
  const detail = step.error ?? step.vault?.message ?? step.decision.reason;
  return `[${label(step)}] ${step.messageId} "${step.subject}"\n    ${detail}`;
}

async function main(): Promise<void> {
  const dryRun = Boolean(values["dry-run"]);
  const messages = await loadInbox(String(values.inbox));
  const suppliers = await loadSuppliers(String(values.suppliers));
  const brain = makeBrain(String(values.brain));
  const vault = makeVault(dryRun);

  console.log(`Phishbowl agent: ${messages.length} messages, brain ${brain.model}${dryRun ? ", dry run" : ""}\n`);
  const results = await processInbox({
    messages,
    brain,
    vault,
    suppliers,
    onStep: (step) => console.log(describe(step)),
  });

  const counts = new Map<string, number>();
  for (const step of results) {
    counts.set(label(step), (counts.get(label(step)) ?? 0) + 1);
  }
  console.log(`\nDone: ${[...counts].map(([name, count]) => `${count} ${name.toLowerCase()}`).join(", ")}.`);

  const outDir = String(values.out);
  await mkdir(outDir, { recursive: true });
  const file = join(outDir, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(file, JSON.stringify({ model: brain.model, dryRun, finishedAt: new Date().toISOString(), results }, null, 2));
  console.log(`Full log saved to ${file}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
