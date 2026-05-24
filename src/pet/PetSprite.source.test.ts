import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pet window event policy", () => {
  it("does not enable transparent click-through cursor ignoring", () => {
    const source = readFileSync(new URL("./PetSprite.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("setIgnoreCursorEvents");
    expect(source).not.toContain("cursorPosition");
    expect(source).not.toContain("cursorPassthrough");
  });

  it("resizes the dashboard each time it opens", () => {
    const source = readFileSync(new URL("./PetSprite.tsx", import.meta.url), "utf8");

    expect(source).toContain("DASHBOARD_DEFAULT_SIZE");
    expect(source).toContain("dashboard.setSize");
  });
});
