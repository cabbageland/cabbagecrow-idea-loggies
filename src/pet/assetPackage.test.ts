import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CabbageCrow asset package", () => {
  it("uses generated row strips rather than the old all-in-one grid", () => {
    const pet = JSON.parse(readFileSync("public/pets/cabbagecrow/pet.json", "utf8"));
    const validation = JSON.parse(
      readFileSync("public/pets/cabbagecrow/validation.json", "utf8"),
    );

    expect(pet.sourceMode).toBe("generated-row-strips");
    expect(validation.sourceMode).toBe("generated-row-strips");
    expect(validation.detectedFrames).toBe(72);
  });

  it("keeps every extracted sprite away from cell edges", () => {
    const validation = JSON.parse(
      readFileSync("public/pets/cabbagecrow/validation.json", "utf8"),
    );

    expect(validation.edgeContactFrames).toEqual([]);
  });

  it("builds the exact Codex atlas geometry", () => {
    const validation = JSON.parse(
      readFileSync("public/pets/cabbagecrow/validation.json", "utf8"),
    );

    expect(validation.atlasWidth).toBe(1536);
    expect(validation.atlasHeight).toBe(1872);
    expect(validation.cellWidth).toBe(192);
    expect(validation.cellHeight).toBe(208);
  });
});
