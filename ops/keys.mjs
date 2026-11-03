// Turns one secret (the PHISHBOWL_SEED repository secret) into the same NEAR
// keys every time, so GitHub Actions can act as the vault and the agent without
// storing private keys anywhere. No dependencies: Node's built-in ed25519.
//
//   node ops/keys.mjs env                    public keys -> $GITHUB_ENV, private keys masked
//   node ops/keys.mjs keychain vault ACCOUNT write ACCOUNT's legacy NEAR CLI key file
//   node ops/keys.mjs agent-env              PHISHBOWL_AGENT_KEY -> $GITHUB_ENV, masked
//   node ops/keys.mjs selftest               check the derivation with a dummy secret
import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");

export function base58(bytes) {
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = `1${out}`;
  }
  return out;
}

/** A NEAR ed25519 key pair derived from the secret and a label ("vault" or "agent"). */
export function keyPair(secret, label) {
  const seed = createHash("sha256").update(`phishbowl:${label}:${secret}`).digest();
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, seed]), format: "der", type: "pkcs8" });
  const spki = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  const pub = spki.subarray(spki.length - 32);
  return {
    publicKey: `ed25519:${base58(pub)}`,
    secretKey: `ed25519:${base58(Buffer.concat([seed, pub]))}`,
    privateKey,
  };
}

function secretFromEnv() {
  const secret = process.env.PHISHBOWL_SEED ?? "";
  if (secret.length < 16) {
    console.error(
      "The PHISHBOWL_SEED repository secret is missing or shorter than 16 characters. " +
        "Add it under Settings > Secrets and variables > Actions.",
    );
    process.exit(1);
  }
  return secret;
}

function toEnv(lines) {
  const file = process.env.GITHUB_ENV;
  if (!file) throw new Error("GITHUB_ENV is not set; run this inside GitHub Actions");
  appendFileSync(file, lines.map((line) => `${line}\n`).join(""));
}

const [command, label, account] = process.argv.slice(2);

if (command === "env") {
  const secret = secretFromEnv();
  const vault = keyPair(secret, "vault");
  const agent = keyPair(secret, "agent");
  console.log(`::add-mask::${vault.secretKey}`);
  console.log(`::add-mask::${agent.secretKey}`);
  toEnv([`VAULT_PUB=${vault.publicKey}`, `AGENT_PUB=${agent.publicKey}`]);
  console.log(`Vault key ${vault.publicKey}\nAgent key ${agent.publicKey}`);
} else if (command === "keychain") {
  if (!["vault", "agent"].includes(label) || !account) throw new Error("usage: keychain vault|agent ACCOUNT");
  const pair = keyPair(secretFromEnv(), label);
  console.log(`::add-mask::${pair.secretKey}`);
  const dir = join(homedir(), ".near-credentials", "testnet");
  const body = JSON.stringify({ account_id: account, public_key: pair.publicKey, private_key: pair.secretKey });
  mkdirSync(join(dir, account), { recursive: true });
  writeFileSync(join(dir, `${account}.json`), body, { mode: 0o600 });
  writeFileSync(join(dir, account, `${pair.publicKey.replace(":", "_")}.json`), body, { mode: 0o600 });
  console.log(`Saved the ${label} key for ${account} (${pair.publicKey})`);
} else if (command === "agent-env") {
  const agent = keyPair(secretFromEnv(), "agent");
  console.log(`::add-mask::${agent.secretKey}`);
  toEnv([`PHISHBOWL_AGENT_KEY=${agent.secretKey}`]);
  console.log(`Agent key ${agent.publicKey} ready`);
} else if (command === "selftest") {
  const a = keyPair("dummy secret for testing only", "vault");
  const b = keyPair("dummy secret for testing only", "vault");
  const c = keyPair("dummy secret for testing only", "agent");
  const message = Buffer.from("phishbowl");
  const signature = sign(null, message, a.privateKey);
  const ok =
    a.publicKey === b.publicKey &&
    a.publicKey !== c.publicKey &&
    verify(null, message, createPublicKey(a.privateKey), signature) &&
    base58(Buffer.from([0, 0, 1])) === "112";
  console.log(ok ? `selftest ok ${a.publicKey}` : "selftest FAILED");
  process.exit(ok ? 0 : 1);
} else {
  console.error("usage: node ops/keys.mjs env | keychain vault|agent ACCOUNT | agent-env | selftest");
  process.exit(2);
}
