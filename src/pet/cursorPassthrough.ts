export interface Point {
  x: number;
  y: number;
}

export interface InteractiveRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function getInteractiveRect(element: Element | null): InteractiveRect | null {
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}

export function isPointInsideInteractiveRects(point: Point, rects: InteractiveRect[]): boolean {
  return rects.some(
    (rect) =>
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom,
  );
}
