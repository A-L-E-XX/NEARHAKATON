import { useNearWallet } from "near-connect-hooks";
import { useCallback, useState, type ReactNode } from "react";
import { useVaults } from "../lib/store";
import { Button, Modal, useToast } from "./ui";

export const GAS_SIMPLE = "30000000000000"; // 30 Tgas
export const GAS_TRANSFER = "100000000000000"; // 100 Tgas: a transfer plus its callback
export const ONE_YOCTO = "1";

function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  if (/reject|denied|cancel/i.test(text)) return "you cancelled it in your wallet.";
  return text.slice(0, 180);
}

/** Sends one call to a vault from the connected wallet, then refreshes the data. */
export function useVaultCall() {
  const { callFunction } = useNearWallet();
  const { refresh } = useVaults();
  const toast = useToast();
  return useCallback(
    async (
      vaultId: string,
      method: string,
      args: Record<string, unknown>,
      options: { deposit?: string; gas?: string; done: string },
    ): Promise<boolean> => {
      try {
        await callFunction({
          contractId: vaultId,
          method,
          args,
          deposit: options.deposit ?? "0",
          gas: options.gas ?? GAS_SIMPLE,
        });
        toast({ tone: "secure", text: options.done });
        await refresh();
        return true;
      } catch (err) {
        toast({ tone: "danger", text: `Not done: ${messageOf(err)}` });
        return false;
      }
    },
    [callFunction, refresh, toast],
  );
}

export interface OwnerActionProps {
  vaultId: string;
  ownerId: string;
  method: string;
  args?: Record<string, unknown>;
  deposit?: string;
  gas?: string;
  label: ReactNode;
  confirmTitle: string;
  confirmText: ReactNode;
  confirmLabel: string;
  done: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "ice";
  size?: "sm" | "md";
  disabled?: boolean;
}

/**
 * A button for something only the vault's owner can do. It explains what will
 * happen, checks the connected wallet is the owner, then asks the wallet to sign.
 */
export function OwnerAction({
  vaultId,
  ownerId,
  method,
  args = {},
  deposit = "0",
  gas,
  label,
  confirmTitle,
  confirmText,
  confirmLabel,
  done,
  variant = "secondary",
  size = "md",
  disabled,
}: OwnerActionProps) {
  const { signedAccountId, signIn } = useNearWallet();
  const call = useVaultCall();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isOwner = signedAccountId !== "" && signedAccountId === ownerId;
  const close = useCallback(() => setOpen(false), []);

  async function confirm() {
    setBusy(true);
    const ok = await call(vaultId, method, args, { deposit, gas, done });
    setBusy(false);
    if (ok) setOpen(false);
  }

  return (
    <>
      <Button variant={variant} size={size} disabled={disabled || busy} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={confirmTitle}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            {signedAccountId ? (
              <Button variant="primary" disabled={!isOwner || busy} onClick={() => void confirm()}>
                {busy ? "Waiting for your wallet" : confirmLabel}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void signIn()}>
                Connect wallet
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <div>{confirmText}</div>
          {deposit === ONE_YOCTO && (
            <p className="text-fog">
              This moves money or loosens the rules, so your wallet asks you to confirm it with a deposit of 1 yoctoNEAR
              (a millionth of a millionth of a NEAR). A website login key can't do this on its own.
            </p>
          )}
          {!signedAccountId && <p className="text-caution">Connect the owner's wallet ({ownerId}) to continue.</p>}
          {signedAccountId && !isOwner && (
            <p className="text-caution">
              You're signed in as {signedAccountId}. Only the owner, {ownerId}, can do this; the vault would refuse it.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
