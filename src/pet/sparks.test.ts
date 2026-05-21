import { describe, expect, it } from "vitest";
import {
  addSpark,
  getPendingSparks,
  pickRandomSpark,
  readStoredSparks,
  resolveSpark,
} from "./sparks";

describe("spark bucket", () => {
  it("adds and resolves sparks", () => {
    const sparks = addSpark([], "Build tiny morning prompt cards", 100, "spark-1");

    expect(getPendingSparks(sparks)).toHaveLength(1);
    expect(resolveSpark(sparks, "spark-1", 200)[0].resolvedAt).toBe(200);
    expect(getPendingSparks(resolveSpark(sparks, "spark-1", 200))).toHaveLength(0);
  });

  it("ignores blank spark text", () => {
    expect(addSpark([], "   ", 100, "spark-1")).toEqual([]);
  });

  it("picks only unresolved sparks and avoids immediate repeats when possible", () => {
    const sparks = [
      { id: "a", text: "A", createdAt: 1, lastSurfacedAt: null, resolvedAt: null },
      { id: "b", text: "B", createdAt: 2, lastSurfacedAt: null, resolvedAt: null },
      { id: "c", text: "C", createdAt: 3, lastSurfacedAt: null, resolvedAt: 4 },
    ];

    expect(pickRandomSpark(sparks, "a", () => 0)?.id).toBe("b");
  });

  it("falls back to an empty list for invalid storage", () => {
    expect(readStoredSparks({ getItem: () => "not-json" })).toEqual([]);
  });
});
