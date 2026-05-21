import { describe, expect, it } from "vitest";
import { getPetButtonScale, getPetWindowSize } from "./windowGeometry";

describe("pet window geometry", () => {
  it("keeps the native window tight around the visible sprite", () => {
    expect(getPetWindowSize(0.65)).toEqual({ width: 172, height: 184 });
    expect(getPetWindowSize(1)).toEqual({ width: 252, height: 270 });
    expect(getPetWindowSize(1.8)).toEqual({ width: 436, height: 469 });
  });

  it("keeps CSS scale independent from native window growth", () => {
    expect(getPetButtonScale(0.2)).toBe(0.65);
    expect(getPetButtonScale(1.45)).toBe(1.45);
    expect(getPetButtonScale(5)).toBe(1.8);
  });
});
