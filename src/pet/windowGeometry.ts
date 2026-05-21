import { clampPetScale } from "./size";

export const BASE_PET_WINDOW = 320;
export const PET_ART_WIDTH = 230;
export const PET_ART_HEIGHT = 248;
export const INNER_SPRITE_SCALE = 1.18;
export const PET_WINDOW_PADDING = 60;

export interface WindowSize {
  width: number;
  height: number;
}

export function getPetButtonScale(scale: number): number {
  return clampPetScale(scale);
}

export function getPetWindowSize(scale: number): WindowSize {
  const safeScale = getPetButtonScale(scale);
  if (safeScale <= 1) {
    return { width: BASE_PET_WINDOW, height: BASE_PET_WINDOW };
  }

  const artWidth = PET_ART_WIDTH * INNER_SPRITE_SCALE * safeScale;
  const artHeight = PET_ART_HEIGHT * INNER_SPRITE_SCALE * safeScale;
  const size = Math.ceil(
    Math.max(BASE_PET_WINDOW, artWidth + PET_WINDOW_PADDING, artHeight + PET_WINDOW_PADDING),
  );

  return { width: size, height: size };
}
