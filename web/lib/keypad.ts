export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back";

export const KEYPAD_KEYS: readonly KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

export type KeypadOptions = {
  /** Max digits before the decimal point. */
  maxInt?: number;
  /** Digits allowed after the point; 0 = whole numbers only. */
  decimals?: number;
};

/** The value as typed, e.g. "12.5". Leading zeros collapse; backspace on one digit → "0". */
export function applyKey(value: string, key: KeypadKey, { maxInt = 3, decimals = 0 }: KeypadOptions = {}): string {
  if (key === "back") return value.length > 1 ? value.slice(0, -1) : "0";
  const [int, frac] = value.split(".");
  if (key === ".") return decimals > 0 && frac === undefined ? `${value}.` : value;
  if (frac !== undefined) return frac.length < decimals ? value + key : value;
  if (int === "0") return key;
  return int.length < maxInt ? value + key : value;
}

export function keypadNumber(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}
