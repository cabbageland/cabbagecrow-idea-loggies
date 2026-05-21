import { describe, expect, it } from "vitest";
import { isPointInsideInteractiveRects } from "./cursorPassthrough";

describe("cursor pass-through", () => {
  it("keeps pointer events only inside explicit interactive rectangles", () => {
    const rects = [
      { left: 30, top: 40, right: 180, bottom: 210 },
      { left: 12, top: 8, right: 220, bottom: 68 },
    ];

    expect(isPointInsideInteractiveRects({ x: 90, y: 120 }, rects)).toBe(true);
    expect(isPointInsideInteractiveRects({ x: 18, y: 20 }, rects)).toBe(true);
    expect(isPointInsideInteractiveRects({ x: 228, y: 90 }, rects)).toBe(false);
  });
});
