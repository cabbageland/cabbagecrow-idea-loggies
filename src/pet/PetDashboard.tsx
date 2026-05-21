import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useState } from "react";
import {
  formatInstallDate,
  getIdeaStats,
  getPetAgeLabel,
  readOrCreateInstallDate,
} from "./dashboardStats";
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
import {
  FREE_RANGE_STORAGE_KEY,
  SPARK_CADENCE_STORAGE_KEY,
  type SparkCadence,
  normalizeSparkCadence,
  readStoredBoolean,
} from "./settings";

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function readSparks(): Spark[] {
  try {
    return readStoredSparks(window.localStorage);
  } catch {
    return [];
  }
}

function readFreeRangeEnabled(): boolean {
  try {
    return readStoredBoolean(window.localStorage, FREE_RANGE_STORAGE_KEY, false);
  } catch {
    return false;
  }
}

function readSparkCadence(): SparkCadence {
  try {
    return normalizeSparkCadence(window.localStorage.getItem(SPARK_CADENCE_STORAGE_KEY));
  } catch {
    return "gentle";
  }
}

function readInstallDate(): string {
  try {
    return readOrCreateInstallDate(window.localStorage);
  } catch {
    return new Date().toISOString();
  }
}

function emitLocalAndNative(eventName: string): void {
  window.dispatchEvent(new CustomEvent(eventName));
  if (isTauriRuntime()) {
    void emit(eventName).catch(() => undefined);
  }
}

function closeDashboard(): void {
  if (isTauriRuntime()) {
    void getCurrentWindow().hide();
    return;
  }
  window.close();
}

function startDashboardDrag(event: ReactPointerEvent<HTMLElement>): void {
  if (
    event.button !== 0 ||
    (event.target instanceof Element &&
      event.target.closest("[data-dashboard-no-drag], button, input, select, textarea, a"))
  ) {
    return;
  }

  if (isTauriRuntime()) {
    void getCurrentWindow().startDragging().catch(() => undefined);
  }
}

function startDashboardResize(event: ReactPointerEvent<HTMLButtonElement>): void {
  event.preventDefault();
  event.stopPropagation();

  if (isTauriRuntime()) {
    void getCurrentWindow().startResizeDragging("SouthEast").catch(() => undefined);
  }
}

export default function PetDashboard() {
  const [sparks, setSparks] = useState(readSparks);
  const [draft, setDraft] = useState("");
  const [nudgedId, setNudgedId] = useState<string | null>(null);
  const [freeRangeEnabled, setFreeRangeEnabled] = useState(readFreeRangeEnabled);
  const [sparkCadence, setSparkCadence] = useState<SparkCadence>(readSparkCadence);
  const [installDate] = useState(readInstallDate);
  const pending = useMemo(
    () => [...getPendingSparks(sparks)].sort((a, b) => b.createdAt - a.createdAt),
    [sparks],
  );
  const ideaStats = useMemo(() => getIdeaStats(sparks), [sparks]);
  const nudged = pending.find((spark) => spark.id === nudgedId) ?? null;

  useEffect(() => {
    try {
      writeStoredSparks(window.localStorage, sparks);
    } catch {
      // Dashboard still works in memory if storage is unavailable.
    }
    emitLocalAndNative("cabbagecrow-sparks-changed");
  }, [sparks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FREE_RANGE_STORAGE_KEY, String(freeRangeEnabled));
      window.localStorage.setItem(SPARK_CADENCE_STORAGE_KEY, sparkCadence);
    } catch {
      // Controls still reflect the active session even if persistence fails.
    }
    emitLocalAndNative("cabbagecrow-settings-changed");
  }, [freeRangeEnabled, sparkCadence]);

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
    <main className="dashboard-shell" aria-label="CabbageCrow idea bucket" onPointerDown={startDashboardDrag}>
      <header className="dashboard-header">
        <div>
          <p className="dashboard-kicker">cabbagecrow bioscan</p>
          <h1>idea loggies 🪵</h1>
          <p>{pending.length} unresolved sparks in the random pool</p>
        </div>
        <button className="icon-button" type="button" aria-label="Close dashboard" onClick={closeDashboard}>
          x
        </button>
      </header>

      <section className="dashboard-stats" aria-label="CabbageCrow stats">
        <article>
          <span>date installed</span>
          <strong>{formatInstallDate(installDate)}</strong>
        </article>
        <article>
          <span>age now</span>
          <strong>{getPetAgeLabel(installDate)}</strong>
        </article>
        <article>
          <span>added</span>
          <strong>{ideaStats.added}</strong>
        </article>
        <article>
          <span>resolved</span>
          <strong>{ideaStats.resolved}</strong>
        </article>
        <article>
          <span>left</span>
          <strong>{ideaStats.left}</strong>
        </article>
      </section>

      <section className="dashboard-settings" aria-label="Pet settings" data-dashboard-no-drag>
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
          <select
            value={sparkCadence}
            onChange={(event) => setSparkCadence(normalizeSparkCadence(event.target.value))}
          >
            <option value="gentle">Gentle</option>
            <option value="normal">Normal</option>
            <option value="frequent">Frequent</option>
          </select>
        </label>
      </section>

      <section className="spark-add-row" aria-label="Add a spark" data-dashboard-no-drag>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              addDraft();
            }
          }}
          placeholder="Capture a spark..."
        />
        <button type="button" onClick={addDraft}>
          Add
        </button>
      </section>

      <section className="nudged-spark" aria-label="Currently nudged spark" data-dashboard-no-drag>
        <div>
          <p className="dashboard-kicker">Currently Nudged</p>
          <p>{nudged?.text ?? "No spark pulled yet."}</p>
        </div>
        <div className="dashboard-actions">
          <button type="button" onClick={pullOne}>
            Pull One Now
          </button>
          {nudged && (
            <button type="button" onClick={() => resolve(nudged.id)}>
              Resolve
            </button>
          )}
        </div>
      </section>

      <section className="pending-sparks" aria-label="Pending sparks" data-dashboard-no-drag>
        <div className="pending-sparks-header">
          <span>Pending Sparks</span>
          <span>
            {ideaStats.left} left / {ideaStats.resolved} resolved / {ideaStats.added} added
          </span>
        </div>
        <div className="pending-sparks-list">
          {pending.length === 0 ? (
            <p className="spark-empty">The bucket is quiet. Add a spark when one lands.</p>
          ) : (
            pending.map((spark) => (
              <article className="spark-row" key={spark.id}>
                <span>{spark.text}</span>
                <button type="button" onClick={() => resolve(spark.id)}>
                  resolve
                </button>
              </article>
            ))
          )}
        </div>
      </section>
      <button
        className="dashboard-resize-handle"
        type="button"
        aria-label="Resize dashboard"
        onPointerDown={startDashboardResize}
      />
    </main>
  );
}
