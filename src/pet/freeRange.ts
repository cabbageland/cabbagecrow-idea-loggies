export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export function chooseFreeRangeTarget(
  bounds: Bounds,
  windowSize: Size,
  random = Math.random,
): Point {
  const maxX = bounds.x + Math.max(0, bounds.width - windowSize.width);
  const maxY = bounds.y + Math.max(0, bounds.height - windowSize.height);

  return {
    x: Math.round(bounds.x + (maxX - bounds.x) * random()),
    y: Math.round(bounds.y + (maxY - bounds.y) * random()),
  };
}

export function interpolatePosition(from: Point, to: Point, progress: number): Point {
  const safeProgress = Math.min(1, Math.max(0, progress));

  return {
    x: Math.round(from.x + (to.x - from.x) * safeProgress),
    y: Math.round(from.y + (to.y - from.y) * safeProgress),
  };
}
