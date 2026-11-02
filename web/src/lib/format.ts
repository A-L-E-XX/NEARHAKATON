const ONE_NEAR = 10n ** 24n;

/** "10000000000000000000000" -> "0.01 NEAR". */
export function near(yocto: string | null | undefined, maxDecimals = 3): string {
  return `${nearNumber(yocto, maxDecimals)} NEAR`;
}

/** "10000000000000000000000" -> "0.01". */
export function nearNumber(yocto: string | null | undefined, maxDecimals = 3): string {
  if (!yocto) return "0";
  const value = BigInt(yocto);
  const whole = value / ONE_NEAR;
  const scale = 10n ** BigInt(24 - maxDecimals);
  const fraction = ((value % ONE_NEAR) / scale).toString().padStart(maxDecimals, "0").replace(/0+$/, "");
  if (whole === 0n && !fraction && value > 0n) return `<0.${"0".repeat(maxDecimals - 1)}1`;
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}

/** "1500000000000000000000000" -> "1.5", exact and without grouping, for exports. */
export function nearExact(yocto: string): string {
  const value = BigInt(yocto);
  const fraction = (value % ONE_NEAR).toString().padStart(24, "0").replace(/0+$/, "");
  return fraction ? `${value / ONE_NEAR}.${fraction}` : (value / ONE_NEAR).toString();
}

/** yoctoNEAR as a JavaScript number of NEAR, for charts and progress bars only. */
export function nearFloat(yocto: string | null | undefined): number {
  if (!yocto) return 0;
  return Number(BigInt(yocto) / 10n ** 18n) / 1e6;
}

/** "1.5" NEAR typed by a person -> yoctoNEAR string. Returns null if it is not a plain amount. */
export function toYocto(text: string): string | null {
  const value = text.trim();
  if (!/^\d+(\.\d{1,24})?$/.test(value)) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  return (BigInt(whole) * ONE_NEAR + BigInt(fraction.padEnd(24, "0"))).toString();
}

export function dateTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function ago(ms: number, now = Date.now()): string {
  const seconds = Math.round((now - ms) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function shortKey(publicKey: string): string {
  return publicKey.length > 22 ? `${publicKey.slice(0, 14)}…${publicKey.slice(-6)}` : publicKey;
}
