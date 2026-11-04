import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps paths inside the app", () => {
    expect(safeNext("/history")).toBe("/history");
    expect(safeNext("/history/abc?x=1")).toBe("/history/abc?x=1");
  });

  it("falls back for anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", null, undefined]) {
      expect(safeNext(bad)).toBe("/today");
    }
  });
});
