import { describe, expect, it } from "vitest";
import { getFrameStyle, getStateConfig, normalizePetState } from "./animation";

describe("animation runtime", () => {
  it("maps known Codex states to row timings", () => {
    expect(getStateConfig("idle")).toMatchObject({ row: 0, frames: 6 });
    expect(getStateConfig("running-left")).toMatchObject({ row: 2, frames: 8 });
    expect(getStateConfig("review")).toMatchObject({ row: 8, frames: 6 });
  });

  it("keeps directional running frames smooth but still battery-friendly", () => {
    for (const state of ["running-left", "running-right"]) {
      const config = getStateConfig(state);

      expect(config.durations.slice(0, -1).every((duration) => duration === 100)).toBe(true);
      expect(config.durations.at(-1)).toBe(180);
    }
  });

  it("falls back unknown states to idle", () => {
    expect(normalizePetState("mystery")).toBe("idle");
  });

  it("calculates background position from row and frame", () => {
    expect(getFrameStyle("jumping", 3, { cellWidth: 192, cellHeight: 208 })).toEqual({
      width: 192,
      height: 208,
      backgroundPosition: "-576px -832px",
    });
  });
});
