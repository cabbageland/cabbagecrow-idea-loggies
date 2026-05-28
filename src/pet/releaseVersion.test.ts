import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const RELEASE_VERSION = "0.1.3";

const readJson = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;

const readFile = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const packageVersionFromToml = (toml: string) => {
  const packageSection = toml.match(/^\[package\]\n(?<body>[\s\S]*?)(?=\n\[|$)/)?.groups?.body ?? "";
  return packageSection.match(/^version = "(?<version>[^"]+)"/m)?.groups?.version;
};

interface VersionedJson {
  version: string;
}

interface PackageLockJson extends VersionedJson {
  packages: {
    "": VersionedJson;
  };
}

describe("release version metadata", () => {
  it("keeps app package metadata on the current release version", () => {
    const packageJson = readJson<VersionedJson>("../../package.json");
    const packageLock = readJson<PackageLockJson>("../../package-lock.json");
    const tauriConfig = readJson<VersionedJson>("../../src-tauri/tauri.conf.json");
    const cargoToml = readFile("../../src-tauri/Cargo.toml");

    expect(packageJson.version).toBe(RELEASE_VERSION);
    expect(packageLock.version).toBe(RELEASE_VERSION);
    expect(packageLock.packages[""].version).toBe(RELEASE_VERSION);
    expect(tauriConfig.version).toBe(RELEASE_VERSION);
    expect(packageVersionFromToml(cargoToml)).toBe(RELEASE_VERSION);
  });
});
