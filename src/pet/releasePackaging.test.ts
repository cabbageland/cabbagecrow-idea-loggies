import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface TauriConfig {
  bundle: {
    macOS?: {
      signingIdentity?: string;
    };
  };
}

const readFile = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("release packaging", () => {
  it("ad-hoc signs macOS app bundles so Gatekeeper sees a sealed bundle signature", () => {
    const config = JSON.parse(readFile("../../src-tauri/tauri.conf.json")) as TauriConfig;

    expect(config.bundle.macOS?.signingIdentity).toBe("-");
  });

  it("packages macOS zips without extended attributes and verifies the signed app", () => {
    const packageJson = JSON.parse(readFile("../../package.json")) as { scripts: Record<string, string> };
    const script = readFile("../../scripts/package_macos_release.sh");

    expect(packageJson.scripts["release:macos"]).toBe("bash scripts/package_macos_release.sh");
    expect(script).toContain("ditto --noextattr --noqtn -c -k --keepParent");
    expect(script).toContain("codesign --verify --deep --strict --verbose=4");
  });
});
