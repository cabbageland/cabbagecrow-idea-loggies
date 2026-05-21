import { describe, expect, it } from "vitest";
import { BASE_PET_WINDOW, getPetButtonScale, getPetWindowSize } from "./windowGeometry";

describe("pet window geometry", () => {
  it("keeps the scaled sprite inside the native window with padding", () => {
    expect(getPetWindowSize(1)).toEqual({ width: BASE_PET_WINDOW, height: BASE_PET_WINDOW });
    expect(getPetWindowSize(1.8)).toEqual({ width: 587, height: 587 });
  });

  it("keeps CSS scale independent from native window growth", () => {
    expect(getPetButtonScale(0.2)).toBe(0.65);
    expect(getPetButtonScale(1.45)).toBe(1.45);
    expect(getPetButtonScale(5)).toBe(1.8);
  });
});
