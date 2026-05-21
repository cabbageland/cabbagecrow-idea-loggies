import type { Direction, PetState } from "./types";

export type PointerGesture = "click" | "drag";

export interface PointerGestureInput {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  threshold?: number;
}

export function classifyPointerGesture({
  startX,
  startY,
  endX,
  endY,
  threshold = 8,
}: PointerGestureInput): PointerGesture {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const distance = Math.hypot(deltaX, deltaY);

  return distance >= threshold ? "drag" : "click";
}

export function getDragDirection(startX: number, currentX: number): Direction {
  return currentX >= startX ? "right" : "left";
}

export interface ModifierClickInput {
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const KEYBOARD_MODE_MAP: Record<string, PetState> = {
  "1": "idle",
  "2": "running-right",
  "3": "running-left",
  "4": "waving",
  "5": "jumping",
  "6": "failed",
  "7": "waiting",
  "8": "running",
  "9": "review",
  b: "running",
  f: "failed",
  i: "idle",
  r: "review",
  w: "waiting",
  Escape: "idle",
};

export function getKeyboardMode(key: string): PetState | null {
  return KEYBOARD_MODE_MAP[key] ?? KEYBOARD_MODE_MAP[key.toLowerCase()] ?? null;
}

export function getModifiedClickMode({
  altKey,
  shiftKey,
  metaKey,
}: ModifierClickInput): PetState | null {
  if (altKey) {
    return "review";
  }
  if (shiftKey) {
    return "running";
  }
  if (metaKey) {
    return "failed";
  }
  return null;
}
