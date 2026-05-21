import { describe, expect, it } from "vitest";
import { chooseFreeRangeTarget, interpolatePosition } from "./freeRange";

describe("free range movement", () => {
  it("chooses a target inside safe monitor bounds", () => {
    const target = chooseFreeRangeTarget(
      { x: 0, y: 0, width: 1440, height: 900 },
      { width: 360, height: 360 },
      () => 0.99,
    );

    expect(target.x).toBeLessThanOrEqual(1080);
    expect(target.y).toBeLessThanOrEqual(540);
  });

  it("interpolates between two positions", () => {
    expect(interpolatePosition({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.25)).toEqual({
      x: 25,
      y: 13,
    });
  });
});
