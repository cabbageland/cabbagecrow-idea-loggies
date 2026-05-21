# CabbageCrow Free Range Idea Bucket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add crop-safe resizing, a Mini Dashboard, free range movement, and a scrollable Idea Bucket where CabbageCrow randomly resurfaces unresolved sparks.

**Architecture:** Keep pure behavior in small tested modules, then wire those modules into React components. Tauri owns native window sizing, positioning, and the dashboard window; React owns state, storage, rendering, and user interactions.

**Tech Stack:** Tauri 2, React, TypeScript, Vite, Vitest, localStorage, macOS app bundle.

---

## Workspace Note

This workspace is not a git repository. Replace commit checkpoints with verification checkpoints. Do not run `git commit` in this workspace unless a repository is initialized first.

## File Structure

- Create `src/pet/windowGeometry.ts`: crop-safe native window dimensions and CSS scale geometry.
- Create `src/pet/windowGeometry.test.ts`: scale/window-size tests.
- Create `src/pet/sparks.ts`: Spark type, storage parsing, add/resolve/list/random selection helpers.
- Create `src/pet/sparks.test.ts`: Spark helper tests.
- Create `src/pet/freeRange.ts`: monitor-safe target selection and path interpolation helpers.
- Create `src/pet/freeRange.test.ts`: bounds and path tests.
- Create `src/pet/PetDashboard.tsx`: Mini Dashboard UI, settings controls, spark input, scrollable pending list.
- Modify `src/App.tsx`: render pet or dashboard based on Tauri window label or URL fallback.
- Modify `src/pet/PetSprite.tsx`: use crop-safe geometry, open dashboard, show spark bubble, run free range loop.
- Modify `src/pet/shortcut.ts`: support dashboard/free-range/spark deep-link commands.
- Modify `src/pet/shortcut.test.ts`: command parsing tests.
- Modify `src/styles.css`: dashboard layout, scrollable spark list, thought bubble, crop-safe stage styles.
- Modify `src-tauri/tauri.conf.json`: add dashboard window and permissions for show/focus/hide/set-position/position reads/monitor reads.
- Modify `docs/apple-shortcuts.md`: document new commands.

## Task 1: Crop-Safe Resize Geometry

**Files:**
- Create: `src/pet/windowGeometry.ts`
- Create: `src/pet/windowGeometry.test.ts`
- Modify: `src/pet/PetSprite.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing geometry test**

Create `src/pet/windowGeometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BASE_PET_WINDOW,
  getPetButtonScale,
  getPetWindowSize,
} from "./windowGeometry";

describe("pet window geometry", () => {
  it("keeps the scaled sprite inside the native window with padding", () => {
    expect(getPetWindowSize(1)).toEqual({ width: BASE_PET_WINDOW, height: BASE_PET_WINDOW });
    expect(getPetWindowSize(1.8)).toEqual({ width: 587, height: 587 });
  });

  it("keeps CSS scale independent from native window growth", () => {
    expect(getPetButtonScale(0.2)).toBe(0.75);
    expect(getPetButtonScale(1.45)).toBe(1.45);
    expect(getPetButtonScale(5)).toBe(1.8);
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npm test -- --run src/pet/windowGeometry.test.ts`

Expected: FAIL because `./windowGeometry` does not exist.

- [ ] **Step 3: Implement geometry helpers**

Create `src/pet/windowGeometry.ts`:

```ts
import { clampPetScale } from "./size";

export const BASE_PET_WINDOW = 320;
export const PET_ART_WIDTH = 230;
export const PET_ART_HEIGHT = 248;
export const INNER_SPRITE_SCALE = 1.18;
export const PET_WINDOW_PADDING = 60;

export interface WindowSize {
  width: number;
  height: number;
}

export function getPetButtonScale(scale: number): number {
  return clampPetScale(scale);
}

export function getPetWindowSize(scale: number): WindowSize {
  const safeScale = getPetButtonScale(scale);
  if (safeScale <= 1) {
    return { width: BASE_PET_WINDOW, height: BASE_PET_WINDOW };
  }

  const artWidth = PET_ART_WIDTH * INNER_SPRITE_SCALE * safeScale;
  const artHeight = PET_ART_HEIGHT * INNER_SPRITE_SCALE * safeScale;
  const size = Math.ceil(Math.max(BASE_PET_WINDOW, artWidth + PET_WINDOW_PADDING, artHeight + PET_WINDOW_PADDING));
  return { width: size, height: size };
}
```

- [ ] **Step 4: Verify geometry test passes**

Run: `npm test -- --run src/pet/windowGeometry.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Wire geometry into the pet**

Modify `src/pet/PetSprite.tsx`:

```ts
import { getPetButtonScale, getPetWindowSize } from "./windowGeometry";
```

Replace the fixed `BASE_WINDOW_SIZE` sizing inside `setNativeWindowScale`:

```ts
async function setNativeWindowScale(scale: number): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const size = getPetWindowSize(scale);
  await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
}
```

Replace the button style:

```ts
const petButtonStyle = { "--pet-scale": getPetButtonScale(petScale) } as CSSProperties;
```

- [ ] **Step 6: Verify app build**

Run: `npm test -- --run && npm run build`

Expected: all tests pass and Vite build succeeds.

## Task 2: Spark Bucket Logic

**Files:**
- Create: `src/pet/sparks.ts`
- Create: `src/pet/sparks.test.ts`

- [ ] **Step 1: Write failing Spark tests**

Create `src/pet/sparks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  addSpark,
  getPendingSparks,
  pickRandomSpark,
  readStoredSparks,
  resolveSpark,
} from "./sparks";

describe("spark bucket", () => {
  it("adds and resolves sparks", () => {
    const sparks = addSpark([], "Build tiny morning prompt cards", 100, "spark-1");
    expect(getPendingSparks(sparks)).toHaveLength(1);
    expect(resolveSpark(sparks, "spark-1", 200)[0].resolvedAt).toBe(200);
    expect(getPendingSparks(resolveSpark(sparks, "spark-1", 200))).toHaveLength(0);
  });

  it("ignores blank spark text", () => {
    expect(addSpark([], "   ", 100, "spark-1")).toEqual([]);
  });

  it("picks only unresolved sparks and avoids immediate repeats when possible", () => {
    const sparks = [
      { id: "a", text: "A", createdAt: 1, lastSurfacedAt: null, resolvedAt: null },
      { id: "b", text: "B", createdAt: 2, lastSurfacedAt: null, resolvedAt: null },
      { id: "c", text: "C", createdAt: 3, lastSurfacedAt: null, resolvedAt: 4 },
    ];
    expect(pickRandomSpark(sparks, "a", () => 0)?.id).toBe("b");
  });

  it("falls back to an empty list for invalid storage", () => {
    expect(readStoredSparks({ getItem: () => "not-json" })).toEqual([]);
  });
});
```

- [ ] **Step 2: Verify Spark tests fail**

Run: `npm test -- --run src/pet/sparks.test.ts`

Expected: FAIL because `./sparks` does not exist.

- [ ] **Step 3: Implement Spark helpers**

Create `src/pet/sparks.ts`:

```ts
export const SPARKS_STORAGE_KEY = "cabbagecrow.sparks";

export interface Spark {
  id: string;
  text: string;
  createdAt: number;
  lastSurfacedAt: number | null;
  resolvedAt: number | null;
}

export interface SparkStorage {
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
}

export function addSpark(sparks: Spark[], text: string, now = Date.now(), id = crypto.randomUUID()): Spark[] {
  const cleanText = text.trim();
  if (!cleanText) {
    return sparks;
  }
  return [
    { id, text: cleanText, createdAt: now, lastSurfacedAt: null, resolvedAt: null },
    ...sparks,
  ];
}

export function resolveSpark(sparks: Spark[], id: string, now = Date.now()): Spark[] {
  return sparks.map((spark) => (spark.id === id ? { ...spark, resolvedAt: now } : spark));
}

export function surfaceSpark(sparks: Spark[], id: string, now = Date.now()): Spark[] {
  return sparks.map((spark) => (spark.id === id ? { ...spark, lastSurfacedAt: now } : spark));
}

export function getPendingSparks(sparks: Spark[]): Spark[] {
  return sparks.filter((spark) => spark.resolvedAt === null);
}

export function pickRandomSpark(
  sparks: Spark[],
  previousSparkId: string | null,
  random = Math.random,
): Spark | null {
  const pending = getPendingSparks(sparks);
  if (pending.length === 0) {
    return null;
  }
  const choices = pending.length > 1 ? pending.filter((spark) => spark.id !== previousSparkId) : pending;
  return choices[Math.floor(random() * choices.length)] ?? choices[0] ?? null;
}

function isSpark(value: unknown): value is Spark {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Spark;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.text === "string" &&
    typeof candidate.createdAt === "number" &&
    (typeof candidate.lastSurfacedAt === "number" || candidate.lastSurfacedAt === null) &&
    (typeof candidate.resolvedAt === "number" || candidate.resolvedAt === null)
  );
}

export function readStoredSparks(storage: SparkStorage): Spark[] {
  const raw = storage.getItem(SPARKS_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSpark) : [];
  } catch {
    return [];
  }
}

export function writeStoredSparks(storage: SparkStorage, sparks: Spark[]): void {
  storage.setItem?.(SPARKS_STORAGE_KEY, JSON.stringify(sparks));
}
```

- [ ] **Step 4: Verify Spark tests pass**

Run: `npm test -- --run src/pet/sparks.test.ts`

Expected: PASS, 4 tests.

## Task 3: Free Range Pure Movement Logic

**Files:**
- Create: `src/pet/freeRange.ts`
- Create: `src/pet/freeRange.test.ts`

- [ ] **Step 1: Write failing free range tests**

Create `src/pet/freeRange.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chooseFreeRangeTarget, interpolatePosition } from "./freeRange";

describe("free range movement", () => {
  it("chooses a target inside safe monitor bounds", () => {
    const target = chooseFreeRangeTarget(
      { x: 0, y: 0, width: 1440, height: 900 },
      { width: 360, height: 360 },
      () => 0.99,
    );
    expect(target.x).toBeLessThanOrEqual(1080);
    expect(target.y).toBeLessThanOrEqual(540);
  });

  it("interpolates between two positions", () => {
    expect(interpolatePosition({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.25)).toEqual({
      x: 25,
      y: 13,
    });
  });
});
```

- [ ] **Step 2: Verify free range tests fail**

Run: `npm test -- --run src/pet/freeRange.test.ts`

Expected: FAIL because `./freeRange` does not exist.

- [ ] **Step 3: Implement free range helpers**

Create `src/pet/freeRange.ts`:

```ts
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export function chooseFreeRangeTarget(bounds: Bounds, windowSize: Size, random = Math.random): Point {
  const maxX = bounds.x + Math.max(0, bounds.width - windowSize.width);
  const maxY = bounds.y + Math.max(0, bounds.height - windowSize.height);
  return {
    x: Math.round(bounds.x + (maxX - bounds.x) * random()),
    y: Math.round(bounds.y + (maxY - bounds.y) * random()),
  };
}

export function interpolatePosition(from: Point, to: Point, progress: number): Point {
  const safeProgress = Math.min(1, Math.max(0, progress));
  return {
    x: Math.round(from.x + (to.x - from.x) * safeProgress),
    y: Math.round(from.y + (to.y - from.y) * safeProgress),
  };
}
```

- [ ] **Step 4: Verify free range tests pass**

Run: `npm test -- --run src/pet/freeRange.test.ts`

Expected: PASS, 2 tests.

## Task 4: Dashboard Window And App Routing

**Files:**
- Modify: `src/App.tsx`
- Modify: `src-tauri/tauri.conf.json`
- Create: `src/pet/PetDashboard.tsx`

- [ ] **Step 1: Add dashboard window config**

Modify `src-tauri/tauri.conf.json` to add a second window entry:

```json
{
  "label": "dashboard",
  "title": "CabbageCrow Ideas",
  "width": 720,
  "height": 560,
  "minWidth": 560,
  "minHeight": 420,
  "resizable": true,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "skipTaskbar": false,
  "shadow": true,
  "visible": false,
  "backgroundColor": "#00000000"
}
```

Update permissions in the existing capability and include both windows:

```json
{
  "windows": ["main", "dashboard"],
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-outer-position",
    "core:window:allow-inner-size",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:window:allow-current-monitor"
  ]
}
```

- [ ] **Step 2: Create a minimal dashboard component**

Create `src/pet/PetDashboard.tsx`:

```tsx
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function PetDashboard() {
  return (
    <main className="dashboard-shell" aria-label="CabbageCrow idea bucket">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-kicker">CABBAGECROW</p>
          <h1>Idea Bucket</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Close dashboard"
          onClick={() => void getCurrentWindow().hide()}
        >
          x
        </button>
      </header>
    </main>
  );
}
```

- [ ] **Step 3: Route by window label**

Modify `src/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import PetDashboard from "./pet/PetDashboard";
import PetSprite from "./pet/PetSprite";

function getPreviewView(): "pet" | "dashboard" {
  return new URLSearchParams(window.location.search).get("view") === "dashboard"
    ? "dashboard"
    : "pet";
}

export default function App() {
  const [view, setView] = useState<"pet" | "dashboard">(getPreviewView);

  useEffect(() => {
    if ("__TAURI_INTERNALS__" in window) {
      setView(getCurrentWindow().label === "dashboard" ? "dashboard" : "pet");
    }
  }, []);

  return view === "dashboard" ? (
    <PetDashboard />
  ) : (
    <main className="pet-stage" aria-label="CabbageCrow desktop pet">
      <PetSprite />
    </main>
  );
}
```

- [ ] **Step 4: Verify app build**

Run: `npm run build`

Expected: TypeScript and Vite build pass.

## Task 5: Dashboard Spark UI With Scrollable Pending List

**Files:**
- Modify: `src/pet/PetDashboard.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Implement dashboard state and controls**

Replace `PetDashboard.tsx` with a component that:

```tsx
import { useEffect, useMemo, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  type Spark,
  addSpark,
  getPendingSparks,
  pickRandomSpark,
  readStoredSparks,
  resolveSpark,
  surfaceSpark,
  writeStoredSparks,
} from "./sparks";

function readSparks(): Spark[] {
  try {
    return readStoredSparks(window.localStorage);
  } catch {
    return [];
  }
}

export default function PetDashboard() {
  const [sparks, setSparks] = useState(readSparks);
  const [draft, setDraft] = useState("");
  const [nudgedId, setNudgedId] = useState<string | null>(null);
  const pending = useMemo(() => getPendingSparks(sparks), [sparks]);
  const nudged = pending.find((spark) => spark.id === nudgedId) ?? null;

  useEffect(() => {
    writeStoredSparks(window.localStorage, sparks);
    window.dispatchEvent(new CustomEvent("cabbagecrow-sparks-changed"));
    void emit("cabbagecrow-sparks-changed");
  }, [sparks]);

  function addDraft() {
    setSparks((current) => addSpark(current, draft));
    setDraft("");
  }

  function pullOne() {
    const spark = pickRandomSpark(sparks, nudgedId);
    if (!spark) {
      setNudgedId(null);
      return;
    }
    setNudgedId(spark.id);
    setSparks((current) => surfaceSpark(current, spark.id));
  }

  function resolve(id: string) {
    setSparks((current) => resolveSpark(current, id));
    if (nudgedId === id) {
      setNudgedId(null);
    }
  }

  return (
    <main className="dashboard-shell" aria-label="CabbageCrow idea bucket">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-kicker">CABBAGECROW</p>
          <h1>Idea Bucket</h1>
          <p>{pending.length} unresolved sparks in the random pool</p>
        </div>
        <button className="icon-button" type="button" aria-label="Close dashboard" onClick={() => void getCurrentWindow().hide()}>
          x
        </button>
      </header>

      <section className="spark-add-row">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addDraft()} placeholder="Capture a spark..." />
        <button type="button" onClick={addDraft}>Add</button>
      </section>

      <section className="nudged-spark">
        <div>
          <p className="dashboard-kicker">Currently Nudged</p>
          <p>{nudged?.text ?? "No spark pulled yet."}</p>
        </div>
        <div className="dashboard-actions">
          <button type="button" onClick={pullOne}>Pull One Now</button>
          {nudged && <button type="button" onClick={() => resolve(nudged.id)}>Resolve</button>}
        </div>
      </section>

      <section className="pending-sparks">
        <div className="pending-sparks-header">
          <span>Pending Sparks</span>
          <span>{pending.length}</span>
        </div>
        <div className="pending-sparks-list">
          {pending.map((spark) => (
            <article className="spark-row" key={spark.id}>
              <span>{spark.text}</span>
              <button type="button" onClick={() => resolve(spark.id)}>resolve</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Add dashboard CSS**

Append to `src/styles.css`:

```css
.dashboard-shell {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto auto auto 1fr;
  gap: 12px;
  padding: 18px;
  background: rgba(7, 17, 15, 0.96);
  border: 1px solid rgba(174, 255, 96, 0.32);
  color: #ddffb1;
}

.dashboard-header,
.spark-add-row,
.dashboard-actions,
.pending-sparks-header,
.spark-row {
  display: flex;
  align-items: center;
}

.dashboard-header,
.pending-sparks-header,
.spark-row {
  justify-content: space-between;
}

.dashboard-kicker {
  margin: 0 0 4px;
  color: #95e044;
  font: 700 12px ui-monospace, SFMono-Regular, Menlo, monospace;
}

.dashboard-header h1 {
  margin: 0;
  font-size: 24px;
}

.dashboard-header p {
  margin: 4px 0 0;
}

.icon-button,
.spark-add-row button,
.dashboard-actions button,
.spark-row button {
  min-height: 32px;
  border: 1px solid rgba(36, 214, 189, 0.46);
  border-radius: 6px;
  background: #0b211d;
  color: #24d6bd;
}

.spark-add-row {
  gap: 8px;
}

.spark-add-row input {
  min-width: 0;
  flex: 1;
  height: 38px;
  box-sizing: border-box;
  border: 1px solid rgba(174, 255, 96, 0.36);
  border-radius: 6px;
  background: #0d1815;
  color: #eaffc8;
  padding: 0 10px;
}

.nudged-spark {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  border: 1px solid rgba(36, 214, 189, 0.45);
  border-radius: 8px;
  background: rgba(8, 28, 24, 0.7);
  padding: 12px;
}

.dashboard-actions {
  gap: 8px;
}

.pending-sparks {
  min-height: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  border: 1px solid rgba(174, 255, 96, 0.26);
  border-radius: 8px;
  background: rgba(5, 13, 11, 0.68);
  overflow: hidden;
}

.pending-sparks-header {
  height: 34px;
  padding: 0 10px;
  border-bottom: 1px solid rgba(174, 255, 96, 0.18);
  color: #95e044;
  font-weight: 800;
}

.pending-sparks-list {
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  gap: 8px;
  align-content: start;
}

.spark-row {
  gap: 10px;
  border: 1px solid rgba(174, 255, 96, 0.22);
  border-radius: 6px;
  padding: 9px 10px;
  background: #0b1513;
}
```

- [ ] **Step 3: Verify dashboard preview build**

Run: `npm run build`

Expected: build succeeds.

## Task 6: Open Dashboard From Pet

**Files:**
- Modify: `src/pet/PetSprite.tsx`

- [ ] **Step 1: Add dashboard opener**

In `PetSprite.tsx`, import:

```ts
import { Window } from "@tauri-apps/api/window";
```

Add:

```ts
async function openDashboard(): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(`${window.location.origin}?view=dashboard`, "cabbagecrow-dashboard");
    return;
  }
  const dashboard = await Window.getByLabel("dashboard");
  if (!dashboard) {
    return;
  }
  await dashboard.show();
  await dashboard.setFocus();
}
```

- [ ] **Step 2: Wire dashboard interaction**

Change context menu handler:

```ts
const onContextMenu = useCallback(
  (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    playReaction("waiting", 700);
    void openDashboard();
  },
  [playReaction],
);
```

Add `d` keyboard handling before pet mode handling:

```ts
if (event.key.toLowerCase() === "d") {
  event.preventDefault();
  void openDashboard();
  return;
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: build succeeds.

## Task 7: Spark Surfacing Bubble In The Pet

**Files:**
- Modify: `src/pet/PetSprite.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add pet-side spark state**

In `PetSprite.tsx`, import Spark helpers:

```ts
import {
  type Spark,
  pickRandomSpark,
  readStoredSparks,
  surfaceSpark,
  writeStoredSparks,
} from "./sparks";
```

Add state:

```ts
const [nudgedSpark, setNudgedSpark] = useState<Spark | null>(null);
const lastNudgedSparkId = useRef<string | null>(null);
```

Add helper:

```ts
const pullRandomSpark = useCallback(() => {
  try {
    const sparks = readStoredSparks(window.localStorage);
    const spark = pickRandomSpark(sparks, lastNudgedSparkId.current);
    if (!spark) {
      return;
    }
    lastNudgedSparkId.current = spark.id;
    setNudgedSpark(spark);
    writeStoredSparks(window.localStorage, surfaceSpark(sparks, spark.id));
    playReaction("review", 1300);
    window.setTimeout(() => setNudgedSpark(null), 12000);
  } catch {
    setNudgedSpark(null);
  }
}, [playReaction]);
```

- [ ] **Step 2: Render bubble**

Inside the pet button, before `.pet-sprite`:

```tsx
{nudgedSpark && <span className="spark-bubble">{nudgedSpark.text}</span>}
```

- [ ] **Step 3: Add bubble CSS**

Append:

```css
.spark-bubble {
  position: absolute;
  max-width: min(260px, 78vw);
  bottom: 84%;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 10px;
  border: 1px solid rgba(36, 214, 189, 0.5);
  border-radius: 8px;
  background: rgba(7, 18, 15, 0.94);
  color: #eaffc8;
  font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32);
  pointer-events: none;
}
```

Ensure `.pet-button` has `position: relative;`.

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: build succeeds.

## Task 8: Free Range Runtime Loop

**Files:**
- Modify: `src/pet/PetSprite.tsx`
- Modify: `src/pet/shortcut.ts`
- Modify: `src/pet/shortcut.test.ts`
- Modify: `docs/apple-shortcuts.md`

- [ ] **Step 1: Extend shortcut parser tests**

Add to `src/pet/shortcut.test.ts`:

```ts
it("parses dashboard and free range commands", () => {
  expect(parseShortcutUrl("cabbagecrow://dashboard/open")).toEqual({
    type: "dashboard",
    action: "open",
  });
  expect(parseShortcutUrl("cabbagecrow://free-range/on")).toEqual({
    type: "free-range",
    action: "on",
  });
  expect(parseShortcutUrl("cabbagecrow://free-range/off")).toEqual({
    type: "free-range",
    action: "off",
  });
});
```

- [ ] **Step 2: Verify shortcut test fails**

Run: `npm test -- --run src/pet/shortcut.test.ts`

Expected: FAIL because dashboard/free-range commands are not parsed.

- [ ] **Step 3: Extend shortcut parser**

Modify `ShortcutCommand` in `src/pet/shortcut.ts`:

```ts
export type ShortcutCommand =
  | { type: "mode"; state: PetState }
  | { type: "size"; action: "up" | "down" | "reset" }
  | { type: "size"; action: "set"; scale: number }
  | { type: "dashboard"; action: "open" }
  | { type: "free-range"; action: "on" | "off" | "toggle" };
```

Add parsing:

```ts
if (command === "dashboard" && value === "open") {
  return { type: "dashboard", action: "open" };
}

if (command === "free-range" && (value === "on" || value === "off" || value === "toggle")) {
  return { type: "free-range", action: value };
}
```

- [ ] **Step 4: Add free range runtime state**

In `PetSprite.tsx`, add:

```ts
const FREE_RANGE_STORAGE_KEY = "cabbagecrow.freeRangeEnabled";
const FREE_RANGE_INTERVAL_MS = 90_000;
const SPARK_CADENCE_STORAGE_KEY = "cabbagecrow.sparkCadence";
const SPARK_CADENCE_MS: Record<string, number> = {
  gentle: 90 * 60 * 1000,
  normal: 45 * 60 * 1000,
  frequent: 20 * 60 * 1000,
};
```

Add state:

```ts
const [freeRangeEnabled, setFreeRangeEnabled] = useState(() => window.localStorage.getItem(FREE_RANGE_STORAGE_KEY) === "true");
const [sparkCadence, setSparkCadence] = useState(() => window.localStorage.getItem(SPARK_CADENCE_STORAGE_KEY) ?? "gentle");
```

Persist it:

```ts
useEffect(() => {
  window.localStorage.setItem(FREE_RANGE_STORAGE_KEY, String(freeRangeEnabled));
}, [freeRangeEnabled]);

useEffect(() => {
  const refreshSettings = () => {
    setFreeRangeEnabled(window.localStorage.getItem(FREE_RANGE_STORAGE_KEY) === "true");
    setSparkCadence(window.localStorage.getItem(SPARK_CADENCE_STORAGE_KEY) ?? "gentle");
  };

  window.addEventListener("storage", refreshSettings);
  window.addEventListener("cabbagecrow-settings-changed", refreshSettings);
  let unlisten: (() => void) | null = null;
  if (isTauriRuntime()) {
    void listen("cabbagecrow-settings-changed", refreshSettings).then((handler) => {
      unlisten = handler;
    });
  }
  return () => {
    window.removeEventListener("storage", refreshSettings);
    window.removeEventListener("cabbagecrow-settings-changed", refreshSettings);
    unlisten?.();
  };
}, []);
```

- [ ] **Step 5: Add movement function**

Import:

```ts
import { PhysicalPosition } from "@tauri-apps/api/window";
import { chooseFreeRangeTarget, interpolatePosition } from "./freeRange";
```

Add:

```ts
const runFreeRangeTrip = useCallback(async () => {
  if (!isTauriRuntime() || pointerStart.current) {
    return;
  }

  const appWindow = getCurrentWindow();
  const monitor = await appWindow.currentMonitor();
  if (!monitor) {
    return;
  }

  const from = await appWindow.outerPosition();
  const size = await appWindow.innerSize();
  const target = chooseFreeRangeTarget(
    {
      x: monitor.position.x,
      y: monitor.position.y,
      width: monitor.size.width,
      height: monitor.size.height,
    },
    { width: size.width, height: size.height },
  );

  setState(target.x >= from.x ? "running-right" : "running-left");
  for (let step = 1; step <= 24; step += 1) {
    const point = interpolatePosition(from, target, step / 24);
    await appWindow.setPosition(new PhysicalPosition(point.x, point.y));
    await new Promise((resolve) => window.setTimeout(resolve, 35));
  }
  playReaction("idle");
  pullRandomSpark();
}, [playReaction, pullRandomSpark]);
```

- [ ] **Step 6: Add interval**

Add:

```ts
useEffect(() => {
  if (!freeRangeEnabled) {
    return;
  }

  const timer = window.setInterval(() => {
    void runFreeRangeTrip();
  }, FREE_RANGE_INTERVAL_MS);
  return () => window.clearInterval(timer);
}, [freeRangeEnabled, runFreeRangeTrip]);
```

Add independent spark resurfacing:

```ts
useEffect(() => {
  const delay = SPARK_CADENCE_MS[sparkCadence] ?? SPARK_CADENCE_MS.gentle;
  const timer = window.setInterval(() => {
    pullRandomSpark();
  }, delay);
  return () => window.clearInterval(timer);
}, [pullRandomSpark, sparkCadence]);
```

- [ ] **Step 7: Apply shortcut commands**

In `applyShortcutUrl`, handle:

```ts
if (command.type === "dashboard") {
  void openDashboard();
  return;
}

if (command.type === "free-range") {
  setFreeRangeEnabled((current) =>
    command.action === "toggle" ? !current : command.action === "on",
  );
  playReaction("waving", 700);
  return;
}
```

- [ ] **Step 8: Update Apple Shortcuts docs**

Add to `docs/apple-shortcuts.md`:

```text
cabbagecrow://dashboard/open
cabbagecrow://free-range/on
cabbagecrow://free-range/off
cabbagecrow://free-range/toggle
```

- [ ] **Step 9: Verify tests and build**

Run: `npm test -- --run && npm run build`

Expected: all tests pass and Vite build succeeds.

## Task 9: Dashboard Free Range Controls

**Files:**
- Modify: `src/pet/PetDashboard.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add free range controls to dashboard**

In `PetDashboard.tsx`, add:

```ts
const FREE_RANGE_STORAGE_KEY = "cabbagecrow.freeRangeEnabled";
const [freeRangeEnabled, setFreeRangeEnabled] = useState(() => window.localStorage.getItem(FREE_RANGE_STORAGE_KEY) === "true");
const [sparkCadence, setSparkCadence] = useState(() => window.localStorage.getItem("cabbagecrow.sparkCadence") ?? "gentle");

useEffect(() => {
  window.localStorage.setItem(FREE_RANGE_STORAGE_KEY, String(freeRangeEnabled));
  window.localStorage.setItem("cabbagecrow.sparkCadence", sparkCadence);
  window.dispatchEvent(new CustomEvent("cabbagecrow-settings-changed"));
  void emit("cabbagecrow-settings-changed");
}, [freeRangeEnabled, sparkCadence]);
```

Render before the add row:

```tsx
<section className="dashboard-settings">
  <label>
    <span>Free range</span>
    <input
      type="checkbox"
      checked={freeRangeEnabled}
      onChange={(event) => setFreeRangeEnabled(event.target.checked)}
    />
  </label>
  <label>
    <span>Spark cadence</span>
    <select value={sparkCadence} onChange={(event) => setSparkCadence(event.target.value)}>
      <option value="gentle">Gentle</option>
      <option value="normal">Normal</option>
      <option value="frequent">Frequent</option>
    </select>
  </label>
</section>
```

- [ ] **Step 2: Add settings CSS**

Append:

```css
.dashboard-settings {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid rgba(174, 255, 96, 0.26);
  border-radius: 8px;
  padding: 10px 12px;
  background: rgba(8, 18, 15, 0.88);
}

.dashboard-settings label {
  display: flex;
  align-items: center;
  gap: 12px;
}
```

- [ ] **Step 3: Verify dashboard still builds**

Run: `npm run build`

Expected: build succeeds.

## Task 10: Native Build And Package

**Files:**
- Rebuild existing artifacts under `dist-macos/`

- [ ] **Step 1: Run complete verification**

Run: `npm test -- --run`

Expected: all tests pass.

Run: `npm run build`

Expected: TypeScript and Vite build pass.

- [ ] **Step 2: Build native app**

Run: `npm run tauri:build`

Expected: Tauri release build succeeds and produces `src-tauri/target/release/bundle/macos/CabbageCrow.app`.

- [ ] **Step 3: Stage and sign app**

Run:

```bash
mkdir -p /private/tmp/cabbagecrow-package-free-range
ditto --norsrc --noextattr src-tauri/target/release/bundle/macos/CabbageCrow.app /private/tmp/cabbagecrow-package-free-range/CabbageCrow.app
xattr -cr /private/tmp/cabbagecrow-package-free-range/CabbageCrow.app
codesign --force --deep --sign - /private/tmp/cabbagecrow-package-free-range/CabbageCrow.app
codesign --verify --deep --strict --verbose=2 /private/tmp/cabbagecrow-package-free-range/CabbageCrow.app
```

Expected: codesign reports valid on disk and satisfies its Designated Requirement.

- [ ] **Step 4: Create DMG**

Run:

```bash
hdiutil create -volname CabbageCrow -srcfolder /private/tmp/cabbagecrow-package-free-range/CabbageCrow.app -format UDZO /private/tmp/cabbagecrow-package-free-range/CabbageCrow.dmg
cp /private/tmp/cabbagecrow-package-free-range/CabbageCrow.dmg dist-macos/CabbageCrow.dmg
hdiutil verify dist-macos/CabbageCrow.dmg
```

Expected: `hdiutil verify` reports the checksum is valid.
