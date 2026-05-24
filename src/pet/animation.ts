import type { PetState, PetStateConfig, SpriteGeometry } from "./types";

export const DEFAULT_CELL_WIDTH = 192;
export const DEFAULT_CELL_HEIGHT = 208;

export const STATE_CONFIGS: Record<PetState, PetStateConfig> = {
  idle: {
    row: 0,
    frames: 6,
    durations: [280, 110, 110, 140, 140, 320],
  },
  "running-right": {
    row: 1,
    frames: 8,
    durations: [100, 100, 100, 100, 100, 100, 100, 180],
  },
  "running-left": {
    row: 2,
    frames: 8,
    durations: [100, 100, 100, 100, 100, 100, 100, 180],
  },
  waving: {
    row: 3,
    frames: 4,
    durations: [140, 140, 140, 280],
  },
  jumping: {
    row: 4,
    frames: 5,
    durations: [140, 140, 140, 140, 280],
  },
  failed: {
    row: 5,
    frames: 8,
    durations: [140, 140, 140, 140, 140, 140, 140, 240],
  },
  waiting: {
    row: 6,
    frames: 6,
    durations: [150, 150, 150, 150, 150, 260],
  },
  running: {
    row: 7,
    frames: 6,
    durations: [120, 120, 120, 120, 120, 220],
  },
  review: {
    row: 8,
    frames: 6,
    durations: [150, 150, 150, 150, 150, 280],
  },
};

export interface FrameStyle {
  width: number;
  height: number;
  backgroundPosition: string;
}

export function normalizePetState(state: string): PetState {
  return state in STATE_CONFIGS ? (state as PetState) : "idle";
}

export function getStateConfig(state: string): PetStateConfig {
  return STATE_CONFIGS[normalizePetState(state)];
}

export function getFrameStyle(
  state: string,
  frameIndex: number,
  geometry: Partial<SpriteGeometry> = {},
): FrameStyle {
  const cellWidth = geometry.cellWidth ?? DEFAULT_CELL_WIDTH;
  const cellHeight = geometry.cellHeight ?? DEFAULT_CELL_HEIGHT;
  const config = getStateConfig(state);
  const safeFrame = Math.max(0, frameIndex) % config.frames;

  return {
    width: cellWidth,
    height: cellHeight,
    backgroundPosition: `-${safeFrame * cellWidth}px -${config.row * cellHeight}px`,
  };
}

export function getFrameDuration(state: string, frameIndex: number): number {
  const config = getStateConfig(state);
  return config.durations[Math.max(0, frameIndex) % config.frames];
}
