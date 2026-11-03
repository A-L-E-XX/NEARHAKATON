// Read-only calls to NEAR's JSON-RPC. Nothing here can sign or move money.
import { RPC_FALLBACKS, RPC_URL } from "../config";

interface RpcResponse<T> {
  result?: T & { error?: string };
  error?: { message?: string; cause?: { name?: string; info?: unknown } };
}

/**
 * POST to the main RPC node, falling back to the others if it can't be reached or
 * is rate limiting (busy nodes often answer without CORS headers, which the
 * browser reports as a network error).
 */
async function rpcFetch(body: string): Promise<Response> {
  let lastError: unknown = null;
  for (const url of [RPC_URL, ...RPC_FALLBACKS]) {
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`NEAR RPC answered ${response.status}`);
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("NEAR RPC can't be reached");
}

async function query<T>(params: Record<string, unknown>): Promise<T> {
  const response = await rpcFetch(
    JSON.stringify({ jsonrpc: "2.0", id: "phishbowl", method: "query", params: { finality: "final", ...params } }),
  );
  if (!response.ok) {
    throw new Error(`NEAR RPC answered ${response.status}`);
  }
  const body = (await response.json()) as RpcResponse<T>;
  if (body.error) {
    throw new Error(body.error.cause?.name ?? body.error.message ?? "NEAR RPC error");
  }
  if (!body.result) {
    throw new Error("Empty answer from NEAR RPC");
  }
  if (typeof body.result.error === "string") {
    throw new Error(body.result.error);
  }
  return body.result;
}

/** Call a view method on a contract and parse its JSON result. */
export async function view<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await query<{ result: number[] }>({
    request_type: "call_function",
    account_id: contractId,
    method_name: method,
    args_base64: btoa(JSON.stringify(args)),
  });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(result.result))) as T;
}

export interface AccountInfo {
  amount: string;
  locked: string;
  storage_usage: number;
  code_hash: string;
}

export function viewAccount(accountId: string): Promise<AccountInfo> {
  return query<AccountInfo>({ request_type: "view_account", account_id: accountId });
}

export type AccessKey =
  | { publicKey: string; kind: "full" }
  | { publicKey: string; kind: "function"; receiver: string; methods: string[]; allowance: string | null };

interface RawKey {
  public_key: string;
  access_key: {
    permission:
      | "FullAccess"
      | { FunctionCall: { allowance: string | null; receiver_id: string; method_names: string[] } };
  };
}

/** Every key on an account and what it is allowed to do. */
export async function viewAccessKeys(accountId: string): Promise<AccessKey[]> {
  const result = await query<{ keys: RawKey[] }>({ request_type: "view_access_key_list", account_id: accountId });
  return result.keys.map((key) => {
    const permission = key.access_key.permission;
    if (permission === "FullAccess") {
      return { publicKey: key.public_key, kind: "full" as const };
    }
    return {
      publicKey: key.public_key,
      kind: "function" as const,
      receiver: permission.FunctionCall.receiver_id,
      methods: permission.FunctionCall.method_names,
      allowance: permission.FunctionCall.allowance,
    };
  });
}

/** NEAR's account name rules: 2 to 64 lowercase letters, digits and - _ . separators. */
const ACCOUNT_ID = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function isAccountId(value: string): boolean {
  return ACCOUNT_ID.test(value);
}

export interface RpcHealth {
  chainId: string;
  latestBlock: number;
  latestBlockTime: string;
  ms: number;
}

/** Ask the RPC node for its status, timing the round trip. */
export async function rpcHealth(): Promise<RpcHealth> {
  const started = performance.now();
  const response = await rpcFetch(JSON.stringify({ jsonrpc: "2.0", id: "phishbowl", method: "status", params: [] }));
  if (!response.ok) throw new Error(`NEAR RPC answered ${response.status}`);
  const body = (await response.json()) as {
    result?: { chain_id: string; sync_info: { latest_block_height: number; latest_block_time: string } };
  };
  if (!body.result) throw new Error("Empty answer from NEAR RPC");
  return {
    chainId: body.result.chain_id,
    latestBlock: body.result.sync_info.latest_block_height,
    latestBlockTime: body.result.sync_info.latest_block_time,
    ms: Math.round(performance.now() - started),
  };
}

/** Turn RPC errors into a sentence a person can act on. */
export function explainNearError(err: unknown, accountId: string): string {
  const text = err instanceof Error ? err.message : String(err);
  if (/UNKNOWN_ACCOUNT|does not exist|doesn't exist/i.test(text)) {
    return `There is no account called ${accountId} on NEAR testnet.`;
  }
  if (/NO_CONTRACT_CODE|CodeDoesNotExist|MethodNotFound|MethodResolveError/i.test(text)) {
    return `${accountId} exists but is not a Phishbowl vault.`;
  }
  return `Could not read ${accountId} from NEAR testnet (${text.slice(0, 120)}).`;
}
