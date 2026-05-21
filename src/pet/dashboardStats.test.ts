import { describe, expect, it } from "vitest";
import { getIdeaStats, getPetAgeLabel, readOrCreateInstallDate } from "./dashboardStats";

describe("dashboard stats", () => {
  it("counts added, resolved, and left ideas", () => {
    expect(
      getIdeaStats([
        { id: "a", text: "A", createdAt: 1, lastSurfacedAt: null, resolvedAt: null },
        { id: "b", text: "B", createdAt: 2, lastSurfacedAt: null, resolvedAt: 3 },
        { id: "c", text: "C", createdAt: 4, lastSurfacedAt: null, resolvedAt: null },
      ]),
    ).toEqual({ added: 3, resolved: 1, left: 2 });
  });

  it("formats pet age in days from the install date", () => {
    expect(getPetAgeLabel("2026-05-20T10:00:00.000Z", Date.UTC(2026, 4, 20, 12))).toBe(
      "0 days old",
    );
    expect(getPetAgeLabel("2026-05-20T10:00:00.000Z", Date.UTC(2026, 4, 22, 12))).toBe(
      "2 days old",
    );
  });

  it("creates an install date when storage is empty", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(readOrCreateInstallDate(storage, Date.UTC(2026, 4, 20, 12))).toBe(
      "2026-05-20T12:00:00.000Z",
    );
  });
});
