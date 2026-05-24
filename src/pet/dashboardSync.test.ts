import { describe, expect, it } from "vitest";
import { getSyncedSparks } from "./dashboardSync";
import type { Spark } from "./sparks";

const pendingSpark: Spark = {
  id: "spark-1",
  text: "Try the moss keyboard idea",
  createdAt: 10,
  lastSurfacedAt: null,
  resolvedAt: null,
};

describe("dashboard spark sync", () => {
  it("replaces stale dashboard sparks when an external resolve arrives", () => {
    const resolvedSpark = { ...pendingSpark, resolvedAt: 20 };

    expect(getSyncedSparks([pendingSpark], [resolvedSpark])).toEqual([resolvedSpark]);
  });

  it("keeps the current array when stored sparks have not changed", () => {
    const current = [pendingSpark];

    expect(getSyncedSparks(current, [{ ...pendingSpark }])).toBe(current);
  });
});
