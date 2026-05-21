import { describe, expect, it } from "vitest";
import {
  clampPetScale,
  getKeyboardResizeCommand,
  getNextPetScale,
  getScaleFromVerticalDrag,
  readStoredPetScale,
} from "./size";

describe("pet sizing", () => {
  it("clamps scale to the supported pet range", () => {
    expect(clampPetScale(0.2)).toBe(0.65);
    expect(clampPetScale(1.23)).toBe(1.23);
    expect(clampPetScale(9)).toBe(1.8);
  });

  it("steps scale up, down, and back to default", () => {
    expect(getNextPetScale(1, "up")).toBe(1.1);
    expect(getNextPetScale(1, "down")).toBe(0.9);
    expect(getNextPetScale(1.4, "reset")).toBe(1);
  });

  it("maps resize keyboard shortcuts", () => {
    expect(getKeyboardResizeCommand("+")).toBe("up");
    expect(getKeyboardResizeCommand("=")).toBe("up");
    expect(getKeyboardResizeCommand("-")).toBe("down");
    expect(getKeyboardResizeCommand("_")).toBe("down");
    expect(getKeyboardResizeCommand("0")).toBe("reset");
    expect(getKeyboardResizeCommand("x")).toBeNull();
  });

  it("uses vertical drag distance to scale the pet", () => {
    expect(getScaleFromVerticalDrag(1, 200, 176)).toBe(1.1);
    expect(getScaleFromVerticalDrag(1, 200, 224)).toBe(0.9);
  });

  it("ignores invalid stored scale values", () => {
    expect(readStoredPetScale({ getItem: () => "1.3" })).toBe(1.3);
    expect(readStoredPetScale({ getItem: () => "huge" })).toBe(1);
    expect(readStoredPetScale({ getItem: () => null })).toBe(1);
  });
});
