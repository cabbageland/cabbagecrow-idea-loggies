import { describe, expect, it } from "vitest";
import {
  classifyPointerGesture,
  getDragDirection,
  getKeyboardMode,
  getModifiedClickMode,
} from "./interaction";

describe("interaction runtime", () => {
  it("classifies small movement as a click", () => {
    expect(classifyPointerGesture({ startX: 10, startY: 10, endX: 14, endY: 12 })).toBe(
      "click",
    );
  });

  it("classifies larger movement as drag", () => {
    expect(classifyPointerGesture({ startX: 10, startY: 10, endX: 40, endY: 12 })).toBe(
      "drag",
    );
  });

  it("detects horizontal drag direction", () => {
    expect(getDragDirection(5, 30)).toBe("right");
    expect(getDragDirection(30, 5)).toBe("left");
  });

  it("maps keyboard shortcuts to every pet mode", () => {
    expect(getKeyboardMode("1")).toBe("idle");
    expect(getKeyboardMode("2")).toBe("running-right");
    expect(getKeyboardMode("3")).toBe("running-left");
    expect(getKeyboardMode("4")).toBe("waving");
    expect(getKeyboardMode("5")).toBe("jumping");
    expect(getKeyboardMode("6")).toBe("failed");
    expect(getKeyboardMode("7")).toBe("waiting");
    expect(getKeyboardMode("8")).toBe("running");
    expect(getKeyboardMode("9")).toBe("review");
    expect(getKeyboardMode("b")).toBe("running");
    expect(getKeyboardMode("F")).toBe("failed");
    expect(getKeyboardMode("r")).toBe("review");
    expect(getKeyboardMode("Escape")).toBe("idle");
  });

  it("maps modifier clicks to non-default modes", () => {
    expect(getModifiedClickMode({ altKey: true, shiftKey: false, metaKey: false })).toBe(
      "review",
    );
    expect(getModifiedClickMode({ altKey: false, shiftKey: true, metaKey: false })).toBe(
      "running",
    );
    expect(getModifiedClickMode({ altKey: false, shiftKey: false, metaKey: true })).toBe(
      "failed",
    );
    expect(getModifiedClickMode({ altKey: false, shiftKey: false, metaKey: false })).toBeNull();
  });
});
