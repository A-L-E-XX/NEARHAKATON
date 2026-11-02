// Amounts are converted with integer maths on strings, never with floating point.

const DECIMALS = 24;
const ONE_NEAR = 10n ** 24n;
const DECIMAL = /^\d+(\.\d+)?$/;

/** "0.25" -> "250000000000000000000000" (yoctoNEAR). Throws on anything that is not a plain decimal. */
export function nearToYocto(amount: string): string {
  const text = amount.trim();
  if (!DECIMAL.test(text)) {
    throw new Error(`Not a valid NEAR amount: "${amount}"`);
  }
  const [whole = "0", fraction = ""] = text.split(".");
  if (fraction.length > DECIMALS) {
    throw new Error(`Too many decimal places in "${amount}"`);
  }
  const yocto = BigInt(whole) * ONE_NEAR + BigInt(fraction.padEnd(DECIMALS, "0"));
  return yocto.toString();
}

/** "250000000000000000000000" -> "0.25". */
export function yoctoToNear(yocto: string | bigint): string {
  const value = BigInt(yocto);
  const whole = value / ONE_NEAR;
  const fraction = (value % ONE_NEAR).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** Every amount written in a piece of text, in yoctoNEAR, so "0.4" and "0.40" compare equal. */
export function amountsIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(/\d+(?:\.\d+)?/g)) {
    try {
      found.add(nearToYocto(match[0]));
    } catch {
      // Too many decimals to be money; ignore.
    }
  }
  return found;
}
