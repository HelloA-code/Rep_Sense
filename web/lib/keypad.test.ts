import { describe, expect, it } from "vitest";
import { applyKey, keypadNumber, type KeypadKey } from "./keypad";

const type = (keys: KeypadKey[], opts?: Parameters<typeof applyKey>[2], start = "0") =>
  keys.reduce((v, k) => applyKey(v, k, opts), start);

describe("applyKey", () => {
  it("replaces a lone 0 and appends digits", () => {
    expect(type(["1", "2"])).toBe("12");
    expect(type(["0", "0", "7"])).toBe("7");
  });

  it("caps the number of digits", () => {
    expect(type(["1", "2", "3", "4"], { maxInt: 3 })).toBe("123");
  });

  it("allows one decimal point only when decimals are enabled", () => {
    expect(type(["2", "."])).toBe("2");
    expect(type(["2", ".", "5", "5"], { decimals: 1 })).toBe("2.5");
    expect(type([".", "5", "."], { decimals: 1 })).toBe("0.5");
  });

  it("backspace removes the last character and bottoms out at 0", () => {
    expect(type(["1", "2", "back"])).toBe("1");
    expect(type(["back", "back"])).toBe("0");
    expect(type(["2", ".", "back"], { decimals: 1 })).toBe("2");
  });

  it("parses the typed value", () => {
    expect(keypadNumber("12.5")).toBe(12.5);
    expect(keypadNumber("3.")).toBe(3);
  });
});
