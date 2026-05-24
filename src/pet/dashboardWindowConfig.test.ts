import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DASHBOARD_DEFAULT_SIZE } from "./dashboardWindow";

interface TauriWindowConfig {
  label: string;
  width: number;
  height: number;
}

interface TauriConfig {
  app: {
    windows: TauriWindowConfig[];
  };
}

describe("dashboard window config", () => {
  it("opens the settings board at the wide idea-loggies default size", () => {
    const config = JSON.parse(readFileSync(new URL("../../src-tauri/tauri.conf.json", import.meta.url), "utf8")) as TauriConfig;
    const dashboard = config.app.windows.find((windowConfig) => windowConfig.label === "dashboard");

    expect(dashboard).toMatchObject(DASHBOARD_DEFAULT_SIZE);
  });
});
