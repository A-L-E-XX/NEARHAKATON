# Phishbowl agent

An accounts-payable AI agent for **Brightside Bakery**, a made-up demo business. It reads the bakery's inbox, pays supplier invoices through the Phishbowl vault on NEAR, and reports scams.

The agent never holds the bakery's money. It can only ask the vault, and the vault decides: send, hold for the owner, block, or fail a scam drill.

## How a message is handled

1. **The brain decides.** An open model on [NEAR AI Cloud](https://cloud.near.ai) reads the message and calls exactly one tool: `pay_invoice`, `report_scam` or `skip_message`. NEAR AI Cloud runs the model inside a TEE and signs every answer.
2. **Fixed checks run.** The tool arguments are validated (a real NEAR account id, a plain amount, at most 100 NEAR). The model may only pay an account and an amount that appear in the message or in the supplier list, so it cannot invent either.
3. **The vault rules.** The request goes to the vault contract with the agent's function-call key. Each payment memo ends with `ai:<chat id>`, so anyone can fetch the TEE signature for the answer that led to it.

## Try it without any keys

You need Node.js 22.

```bash
cd agent
npm install
npm test
```

You should see every test pass, including:

- `a naive agent falls for the fake 'account changed' email and the vault stops it`
- `a careful agent pays the real invoices and reports the scam`
- `a model that invents an account never reaches the vault`

Then run the agent over the demo inbox with a rule-based brain and no blockchain:

```bash
npm run agent -- --brain naive --dry-run
```

You should see three invoices it would pay, the staff lunch email skipped, and a payment to `goldenmill-billing.testnet`, the fake "our account changed" email. Run `--brain careful` instead and that last email is reported rather than paid.

## Run it for real on testnet

| Setting | What it is |
|---|---|
| `NEAR_AI_API_KEY` | API key from cloud.near.ai |
| `NEAR_AI_MODEL` | Model id, default `deepseek-ai/DeepSeek-V3.1` (list them at `https://cloud-api.near.ai/v1/models`) |
| `PHISHBOWL_VAULT_ID` | The vault contract account |
| `PHISHBOWL_AGENT_ID` | The agent's account |
| `PHISHBOWL_AGENT_KEY` | The agent's function-call key (`ed25519:...`) |
| `NEAR_RPC_URL` | Optional, default `https://test.rpc.fastnear.com` |

```bash
npm run agent
```

Each run prints one line per message and saves the full log to `out/`.

## The agent's key

The agent signs with a **function-call access key** on its own account. That key can only call `propose_payment`, `report_scam` and `freeze` on the vault. It cannot transfer NEAR, call any other contract, or add keys. The owner keeps the account's full-access key, so the agent's account cannot lock itself out if the key's gas allowance runs out.

## Files

| File | What it does |
|---|---|
| `src/brain.ts` | NEAR AI Cloud brain, prompt, and the scripted brains used in tests |
| `src/decision.ts` | Tool definitions and the fixed checks |
| `src/agent.ts` | The loop: decide, check, ask the vault |
| `src/vault.ts` | Calls the vault contract with near-api-js |
| `demo/` | The bakery's suppliers and a sample inbox |
