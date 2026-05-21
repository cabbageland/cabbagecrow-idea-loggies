export type PetState =
  | "idle"
  | "running-right"
  | "running-left"
  | "waving"
  | "jumping"
  | "failed"
  | "waiting"
  | "running"
  | "review";

export type Direction = "left" | "right";

export interface PetPackage {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
  cellWidth?: number;
  cellHeight?: number;
  columns?: number;
}

export interface SpriteGeometry {
  cellWidth: number;
  cellHeight: number;
}

export interface PetStateConfig {
  row: number;
  frames: number;
  durations: number[];
}
