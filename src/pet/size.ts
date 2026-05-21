export type ResizeCommand = "up" | "down" | "reset";

export const DEFAULT_PET_SCALE = 1;
export const MIN_PET_SCALE = 0.65;
export const MAX_PET_SCALE = 1.8;
export const PET_SCALE_STEP = 0.1;
export const PET_SCALE_STORAGE_KEY = "cabbagecrow.petScale";

export function clampPetScale(scale: number): number {
  if (!Number.isFinite(scale)) {
    return DEFAULT_PET_SCALE;
  }

  const clamped = Math.min(MAX_PET_SCALE, Math.max(MIN_PET_SCALE, scale));
  return Math.round(clamped * 100) / 100;
}

export function getNextPetScale(currentScale: number, command: ResizeCommand): number {
  if (command === "reset") {
    return DEFAULT_PET_SCALE;
  }

  const direction = command === "up" ? 1 : -1;
  return clampPetScale(currentScale + direction * PET_SCALE_STEP);
}

export function getKeyboardResizeCommand(key: string): ResizeCommand | null {
  if (key === "+" || key === "=") {
    return "up";
  }
  if (key === "-" || key === "_") {
    return "down";
  }
  if (key === "0") {
    return "reset";
  }
  return null;
}

export interface PetScaleStorage {
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
}

export function readStoredPetScale(storage: PetScaleStorage): number {
  const stored = storage.getItem(PET_SCALE_STORAGE_KEY);
  if (stored === null) {
    return DEFAULT_PET_SCALE;
  }

  return clampPetScale(Number.parseFloat(stored));
}

export function writeStoredPetScale(storage: PetScaleStorage, scale: number): void {
  storage.setItem?.(PET_SCALE_STORAGE_KEY, String(clampPetScale(scale)));
}

export function getScaleFromVerticalDrag(startScale: number, startY: number, currentY: number): number {
  return clampPetScale(startScale + (startY - currentY) / 240);
}
