import { describe, expect, it } from "vitest";
import {
  FREE_RANGE_POSITION_UPDATE_MS,
  chooseFreeRangeTarget,
  interpolatePosition,
  shouldUpdateFreeRangePosition,
} from "./freeRange";

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

  it("throttles native window position updates during flight", () => {
    expect(shouldUpdateFreeRangePosition(100, 100, 0.2)).toBe(false);
    expect(shouldUpdateFreeRangePosition(100 + FREE_RANGE_POSITION_UPDATE_MS - 1, 100, 0.2)).toBe(false);
    expect(shouldUpdateFreeRangePosition(100 + FREE_RANGE_POSITION_UPDATE_MS, 100, 0.2)).toBe(true);
    expect(shouldUpdateFreeRangePosition(120, 100, 1)).toBe(true);
  });

  it("keeps free range movement near 30fps without uncapped native updates", () => {
    expect(FREE_RANGE_POSITION_UPDATE_MS).toBeGreaterThanOrEqual(30);
    expect(FREE_RANGE_POSITION_UPDATE_MS).toBeLessThanOrEqual(34);
  });
});
