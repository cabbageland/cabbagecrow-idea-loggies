import { describe, expect, it } from "vitest";
import {
  CURSOR_PASSTHROUGH_RECOVERY_POLL_MS,
  getCursorPassthroughPollMs,
  isPointInsideInteractiveRects,
  shouldIgnoreCursorEvents,
} from "./cursorPassthrough";

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

  it("only polls native cursor state while recovering from click-through", () => {
    expect(getCursorPassthroughPollMs(false)).toBe(0);
    expect(getCursorPassthroughPollMs(true)).toBe(CURSOR_PASSTHROUGH_RECOVERY_POLL_MS);
  });

  it("keeps cursor events on while dragging or inside interactive regions", () => {
    const rects = [{ left: 30, top: 40, right: 180, bottom: 210 }];

    expect(shouldIgnoreCursorEvents({ pointerIsDragging: true, point: { x: 220, y: 240 }, rects })).toBe(false);
    expect(shouldIgnoreCursorEvents({ pointerIsDragging: false, point: { x: 90, y: 120 }, rects })).toBe(false);
    expect(shouldIgnoreCursorEvents({ pointerIsDragging: false, point: { x: 220, y: 240 }, rects })).toBe(true);
    expect(shouldIgnoreCursorEvents({ pointerIsDragging: false, point: { x: 220, y: 240 }, rects: [] })).toBe(false);
    expect(shouldIgnoreCursorEvents({ pointerIsDragging: false, point: null, rects })).toBe(false);
  });
});
