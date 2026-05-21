import { clampPetScale } from "./size";

export const PET_ART_WIDTH = 230;
export const PET_ART_HEIGHT = 248;
export const PET_WINDOW_PADDING = 22;

export interface WindowSize {
  width: number;
  height: number;
}

export function getPetButtonScale(scale: number): number {
  return clampPetScale(scale);
}

export function getPetWindowSize(scale: number): WindowSize {
  const safeScale = getPetButtonScale(scale);
  const width = Math.ceil(PET_ART_WIDTH * safeScale + PET_WINDOW_PADDING);
  const height = Math.ceil(PET_ART_HEIGHT * safeScale + PET_WINDOW_PADDING);

  return { width, height };
}
