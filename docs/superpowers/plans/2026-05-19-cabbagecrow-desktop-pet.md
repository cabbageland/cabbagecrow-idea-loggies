# CabbageCrow Desktop Pet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS-first Tauri + React + TypeScript desktop pet app that loads and animates a CabbageCrow pet package.

**Architecture:** The React runtime owns animation state, sprite positioning, and pointer interaction decisions. A Hatch-style local asset script converts the generated CabbageCrow pose sheet into a `1536x1872` transparent atlas plus `pet.json`. The Tauri shell files are scaffolded for a transparent always-on-top app, but native compilation requires Rust/Cargo, which is not currently installed.

**Tech Stack:** Vite, React, TypeScript, Vitest, Python/Pillow for one deterministic asset-processing script, Tauri config/Rust shell scaffold.

---

## File Structure

- `package.json`: npm scripts and dependencies.
- `index.html`: Vite app entry.
- `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`: TypeScript/Vite/Vitest setup.
- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: Main app surface.
- `src/styles.css`: Transparent-window-friendly pet UI styling.
- `src/pet/animation.ts`: Codex row timing, sprite math, state fallback.
- `src/pet/interaction.ts`: click-vs-drag and drag direction decisions.
- `src/pet/types.ts`: shared pet package and animation types.
- `src/pet/PetSprite.tsx`: React renderer for a pet package.
- `src/pet/animation.test.ts`: unit tests for timing and sprite coordinates.
- `src/pet/interaction.test.ts`: unit tests for pointer decisions.
- `scripts/build_cabbagecrow_atlas.py`: deterministic source-sheet extraction and packaging.
- `assets/source/cabbagecrow-source.png`: source pose sheet generated from the concept art.
- `public/pets/cabbagecrow/pet.json`: desktop app pet metadata.
- `public/pets/cabbagecrow/spritesheet.webp`: transparent Codex-style atlas.
- `public/pets/cabbagecrow/contact-sheet.png`: QA contact sheet.
- `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`: Tauri app shell scaffold.

## Task 1: Scaffold Testable React Runtime

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/pet/types.ts`

- [ ] **Step 1: Create npm/Vite/TypeScript scaffolding**

Use React with Vite and Vitest. The app entry should mount `<App />` into `#root`.

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: dependencies installed and `package-lock.json` created.

## Task 2: TDD Animation Runtime

**Files:**
- Create: `src/pet/animation.test.ts`
- Create: `src/pet/animation.ts`

- [ ] **Step 1: Write failing animation tests**

Test exact sprite positions and fallback behavior:

```ts
import { describe, expect, it } from "vitest";
import { getFrameStyle, getStateConfig, normalizePetState } from "./animation";

describe("animation runtime", () => {
  it("maps known Codex states to row timings", () => {
    expect(getStateConfig("idle")).toMatchObject({ row: 0, frames: 6 });
    expect(getStateConfig("running-left")).toMatchObject({ row: 2, frames: 8 });
    expect(getStateConfig("review")).toMatchObject({ row: 8, frames: 6 });
  });

  it("falls back unknown states to idle", () => {
    expect(normalizePetState("mystery")).toBe("idle");
  });

  it("calculates background position from row and frame", () => {
    expect(getFrameStyle("jumping", 3, { cellWidth: 192, cellHeight: 208 })).toEqual({
      width: 192,
      height: 208,
      backgroundPosition: "-576px -832px",
    });
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test -- src/pet/animation.test.ts`

Expected: fail because `src/pet/animation.ts` does not exist yet.

- [ ] **Step 3: Implement animation runtime**

Implement row configs, duration lookup, state normalization, and background-position math in `src/pet/animation.ts`.

- [ ] **Step 4: Run animation tests**

Run: `npm test -- src/pet/animation.test.ts`

Expected: pass.

## Task 3: TDD Interaction Runtime

**Files:**
- Create: `src/pet/interaction.test.ts`
- Create: `src/pet/interaction.ts`

- [ ] **Step 1: Write failing interaction tests**

Test drag threshold and direction:

```ts
import { describe, expect, it } from "vitest";
import { classifyPointerGesture, getDragDirection } from "./interaction";

describe("interaction runtime", () => {
  it("classifies small movement as a click", () => {
    expect(classifyPointerGesture({ startX: 10, startY: 10, endX: 14, endY: 12 })).toBe("click");
  });

  it("classifies larger movement as drag", () => {
    expect(classifyPointerGesture({ startX: 10, startY: 10, endX: 40, endY: 12 })).toBe("drag");
  });

  it("detects horizontal drag direction", () => {
    expect(getDragDirection(5, 30)).toBe("right");
    expect(getDragDirection(30, 5)).toBe("left");
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test -- src/pet/interaction.test.ts`

Expected: fail because `src/pet/interaction.ts` does not exist yet.

- [ ] **Step 3: Implement interaction runtime**

Implement `classifyPointerGesture` and `getDragDirection`.

- [ ] **Step 4: Run interaction tests**

Run: `npm test -- src/pet/interaction.test.ts`

Expected: pass.

## Task 4: Build CabbageCrow Pet Package

**Files:**
- Create: `assets/source/cabbagecrow-source.png`
- Create: `scripts/build_cabbagecrow_atlas.py`
- Generate: `public/pets/cabbagecrow/pet.json`
- Generate: `public/pets/cabbagecrow/spritesheet.webp`
- Generate: `public/pets/cabbagecrow/contact-sheet.png`
- Generate: `public/pets/cabbagecrow/validation.json`

- [ ] **Step 1: Copy source pose sheet into the workspace**

Copy `/Users/tracyhan/.codex/generated_images/019e42f2-97b7-7a93-80ea-f7ffc5ab8dda/ig_0fb68746ebc5b92b016a0d19e64f3081949b4665c3b7eba59c.png` to `assets/source/cabbagecrow-source.png`.

- [ ] **Step 2: Create deterministic atlas builder**

Implement a Pillow script that finds non-magenta sprite clusters, ignores row-label text, groups 72 sprite boxes into 9 rows x 8 columns, removes the `#ff00ff` background, centers each sprite into a `192x208` transparent cell, saves `spritesheet.webp`, writes `pet.json`, and writes a validation JSON containing atlas dimensions and detected frame count.

- [ ] **Step 3: Run atlas builder**

Run: `python3 scripts/build_cabbagecrow_atlas.py`

Expected: `public/pets/cabbagecrow/spritesheet.webp` is `1536x1872`, has alpha, and `validation.json` reports `detectedFrames: 72`.

## Task 5: Render CabbageCrow in React

**Files:**
- Create: `src/pet/PetSprite.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Implement the pet renderer**

Create `PetSprite` to load `/pets/cabbagecrow/pet.json`, use `/pets/cabbagecrow/spritesheet.webp` as a CSS background, advance frames by the current state's durations, switch to `jumping` on click, switch to `waving` on double-click, and switch to directional running states while dragging.

- [ ] **Step 2: Wire App**

Render the CabbageCrow pet as the entire first screen.

- [ ] **Step 3: Verify in browser build**

Run: `npm run build`

Expected: Vite production build succeeds.

## Task 6: Scaffold Tauri Shell

**Files:**
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/main.rs`

- [ ] **Step 1: Add Tauri config**

Configure a transparent, frameless, always-on-top `320x320` window served from the Vite dev server in development and `../dist` in production.

- [ ] **Step 2: Add Rust entrypoint**

Create a minimal Tauri app entrypoint that opens the configured window and enables macOS private API support for transparency.

- [ ] **Step 3: Document native build blocker**

Record that `cargo`/`rustc` are absent in this environment, so native `npm run tauri:dev` cannot be verified until Rust is installed.

## Task 7: Final Verification

**Files:**
- Verify all files from previous tasks.

- [ ] **Step 1: Run unit tests**

Run: `npm test -- --run`

Expected: all Vitest tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: Vite build exits successfully.

- [ ] **Step 3: Inspect pet package**

Run: `sips -g pixelWidth -g pixelHeight -g hasAlpha public/pets/cabbagecrow/spritesheet.webp`

Expected: `pixelWidth: 1536`, `pixelHeight: 1872`, alpha-capable WebP if reported by `sips`.

- [ ] **Step 4: Note native Tauri status**

Run: `cargo --version`

Expected in this workspace today: command not found. Report that the Tauri shell is scaffolded but native run/build needs Rust installed.
