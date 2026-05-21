import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard window affordance", () => {
  it("allows dragging from the dashboard shell and keeps controls out of drag starts", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pet/PetDashboard.tsx"), "utf8");

    expect(source).toContain('<main className="dashboard-shell"');
    expect(source).toContain("onPointerDown={startDashboardDrag}");
    expect(source).toContain("data-dashboard-no-drag");
  });

  it("provides a large resize handle", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

    expect(styles).toMatch(/\.dashboard-resize-handle\s*\{[^}]*width:\s*44px/s);
    expect(styles).toMatch(/\.dashboard-resize-handle\s*\{[^}]*height:\s*44px/s);
  });
});
