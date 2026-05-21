import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("pet window chrome", () => {
  it("does not paint a sprite drop shadow or opaque pet background", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

    expect(styles).not.toMatch(/\.pet-sprite\s*\{[^}]*drop-shadow/s);
    expect(styles).toMatch(/\.pet-stage\s*\{[^}]*background:\s*transparent/s);
  });
});
