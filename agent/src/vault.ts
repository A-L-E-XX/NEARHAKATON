import { Account, JsonRpcProvider, teraToGas, type KeyPairString } from "near-api-js";
import { z } from "zod";
import { yoctoToNear } from "./money.ts";
import type { Vault, VaultLists, VaultPaymentResult, VaultReportResult } from "./types.ts";

const ListsSchema = z.object({
  allowlist: z.array(z.string()),
  blocklist: z.array(z.string()),
  reported: z.array(z.string()),
});
const PaymentSchema = z.object({
  outcome: z.enum(["Sent", "Held", "Blocked", "DrillFailed"]),
  request_id: z.number().nullable().optional(),
  message: z.string(),
});
const ReportSchema = z.object({
  outcome: z.enum(["DrillPassed", "Flagged", "AlreadyKnown"]),
  message: z.string(),
});

export interface NearVaultOptions {
  rpcUrl: string;
  vaultId: string;
  agentId: string;
  /**
   * A function-call access key on the agent's account. It can only call
   * propose_payment, report_scam and freeze on the vault, and cannot move NEAR.
   */
  agentKey: string;
}

/** Talks to the deployed Phishbowl vault contract on NEAR. */
export class NearVault implements Vault {
  private readonly provider: JsonRpcProvider;
  private readonly account: Account;

  constructor(private readonly options: NearVaultOptions) {
    this.provider = new JsonRpcProvider({ url: options.rpcUrl });
    this.account = new Account(options.agentId, this.provider, options.agentKey as KeyPairString);
  }

  async lists(): Promise<VaultLists> {
    const raw: unknown = await this.provider.callFunction({
      contractId: this.options.vaultId,
      method: "get_lists",
      args: {},
    });
    return ListsSchema.parse(raw);
  }

  async proposePayment(receiverId: string, amountYocto: string, memo: string): Promise<VaultPaymentResult> {
    const raw: unknown = await this.account.callFunction({
      contractId: this.options.vaultId,
      methodName: "propose_payment",
      args: { receiver_id: receiverId, amount: amountYocto, memo },
      gas: teraToGas("50"),
    });
    return PaymentSchema.parse(raw);
  }

  async reportScam(accountId: string, note: string): Promise<VaultReportResult> {
    const raw: unknown = await this.account.callFunction({
      contractId: this.options.vaultId,
      methodName: "report_scam",
      args: { account_id: accountId, note },
      gas: teraToGas("30"),
    });
    return ReportSchema.parse(raw);
  }
}

/** Shows what the agent would ask for, without touching NEAR. */
export class DryRunVault implements Vault {
  async lists(): Promise<VaultLists> {
    return { allowlist: [], blocklist: [], reported: [] };
  }

  async proposePayment(receiverId: string, amountYocto: string): Promise<VaultPaymentResult> {
    return {
      outcome: "DryRun",
      message: `Would ask the vault to pay ${yoctoToNear(amountYocto)} NEAR to ${receiverId}.`,
    };
  }

  async reportScam(accountId: string): Promise<VaultReportResult> {
    return { outcome: "DryRun", message: `Would report ${accountId} to the vault.` };
  }
}
