import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import {
  type PhysicalSize,
  PhysicalPosition,
  LogicalSize,
  Window as TauriWindow,
  currentMonitor,
  cursorPosition,
  getCurrentWindow,
} from "@tauri-apps/api/window";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFrameDuration, getFrameStyle, getStateConfig } from "./animation";
import { getInteractiveRect, isPointInsideInteractiveRects } from "./cursorPassthrough";
import { chooseFreeRangeTarget, interpolatePosition } from "./freeRange";
import { getDragDirection, getKeyboardMode, getModifiedClickMode } from "./interaction";
import { parseShortcutUrl } from "./shortcut";
import {
  FREE_RANGE_STORAGE_KEY,
  SPARK_CADENCE_STORAGE_KEY,
  type SparkCadence,
  getSparkCadenceMs,
  normalizeSparkCadence,
  readStoredBoolean,
} from "./settings";
import {
  DEFAULT_PET_SCALE,
  clampPetScale,
  getKeyboardResizeCommand,
  getNextPetScale,
  getScaleFromVerticalDrag,
  readStoredPetScale,
  writeStoredPetScale,
} from "./size";
import {
  SPARKS_STORAGE_KEY,
  type Spark,
  addSpark,
  getPendingSparks,
  pickRandomSpark,
  readStoredSparks,
  resolveSpark,
  surfaceSpark,
  writeStoredSparks,
} from "./sparks";
import type { Direction, PetPackage, PetState } from "./types";
import { getPetButtonScale, getPetWindowSize } from "./windowGeometry";

const PET_BASE_PATH = "/pets/cabbagecrow";
const REACTION_MS = 900;
const LONG_PRESS_MS = 520;
const FREE_RANGE_INTERVAL_MS = 8_500;
const FREE_RANGE_TRAVEL_MS = 2_600;
const SPARK_BUBBLE_MS = 10_000;
const SPARKS_CHANGED_EVENT = "cabbagecrow-sparks-changed";
const SETTINGS_CHANGED_EVENT = "cabbagecrow-settings-changed";
const LOOPING_LOCAL_STATES = new Set<PetState>(["idle", "running"]);

interface PointerStart {
  x: number;
  y: number;
  scale: number;
  resizing: boolean;
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function getInitialPetScale(): number {
  try {
    return readStoredPetScale(window.localStorage);
  } catch {
    return DEFAULT_PET_SCALE;
  }
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

function emitAppEvent(eventName: string): void {
  window.dispatchEvent(new CustomEvent(eventName));
  if (isTauriRuntime()) {
    void emit(eventName).catch(() => undefined);
  }
}

function persistSparks(sparks: Spark[]): void {
  try {
    writeStoredSparks(window.localStorage, sparks);
  } catch {
    // The pet keeps its in-memory bucket if storage is unavailable.
  }
  emitAppEvent(SPARKS_CHANGED_EVENT);
}

function persistFreeRangeEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(FREE_RANGE_STORAGE_KEY, String(enabled));
  } catch {
    // Free range can still run for this session without persistence.
  }
  emitAppEvent(SETTINGS_CHANGED_EVENT);
}

async function setNativeWindowScale(scale: number): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const size = getPetWindowSize(scale);
  await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
}

export default function PetSprite() {
  const [pet, setPet] = useState<PetPackage | null>(null);
  const [state, setState] = useState<PetState>("idle");
  const [frame, setFrame] = useState(0);
  const [petScale, setPetScale] = useState(getInitialPetScale);
  const [sparks, setSparks] = useState(readSparks);
  const [surfacedSpark, setSurfacedSpark] = useState<Spark | null>(null);
  const [freeRangeEnabled, setFreeRangeEnabled] = useState(readFreeRangeEnabled);
  const [sparkCadence, setSparkCadence] = useState<SparkCadence>(readSparkCadence);
  const pointerStart = useRef<PointerStart | null>(null);
  const petButtonRef = useRef<HTMLButtonElement | null>(null);
  const sparkBubbleRef = useRef<HTMLElement | null>(null);
  const lastDirection = useRef<Direction>("right");
  const reactionTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const sparkBubbleTimer = useRef<number | null>(null);
  const freeRangeFlight = useRef<number | null>(null);
  const sparksRef = useRef(sparks);
  const previousSparkId = useRef<string | null>(null);
  const freeRangeEnabledRef = useRef(freeRangeEnabled);
  const cursorIgnoringRef = useRef(false);
  const pendingSparkCount = useMemo(() => getPendingSparks(sparks).length, [sparks]);

  useEffect(() => {
    sparksRef.current = sparks;
  }, [sparks]);

  useEffect(() => {
    freeRangeEnabledRef.current = freeRangeEnabled;
  }, [freeRangeEnabled]);

  useEffect(() => {
    let cancelled = false;

    fetch(`${PET_BASE_PATH}/pet.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load pet metadata: ${response.status}`);
        }
        return response.json() as Promise<PetPackage>;
      })
      .then((loadedPet) => {
        if (!cancelled) {
          setPet(loadedPet);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPet({
            id: "fallback",
            displayName: "CabbageCrow",
            description: "Fallback CabbageCrow pet metadata.",
            spritesheetPath: "spritesheet.webp",
            cellWidth: 192,
            cellHeight: 208,
            columns: 8,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFrame(0);
  }, [state]);

  useEffect(() => {
    const duration = getFrameDuration(state, frame);
    const timer = window.setTimeout(() => {
      setFrame((current) => (current + 1) % getStateConfig(state).frames);
    }, duration);

    return () => window.clearTimeout(timer);
  }, [frame, state]);

  useEffect(() => {
    return () => {
      if (reactionTimer.current !== null) {
        window.clearTimeout(reactionTimer.current);
      }
      if (longPressTimer.current !== null) {
        window.clearTimeout(longPressTimer.current);
      }
      if (sparkBubbleTimer.current !== null) {
        window.clearTimeout(sparkBubbleTimer.current);
      }
      if (freeRangeFlight.current !== null) {
        window.cancelAnimationFrame(freeRangeFlight.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      writeStoredPetScale(window.localStorage, petScale);
    } catch {
      // Browser privacy modes can reject localStorage. The active size still applies.
    }

    void setNativeWindowScale(petScale).catch(() => {
      // Browser previews and permission-limited windows can reject native sizing.
    });
  }, [petScale]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let updateInFlight = false;
    const appWindow = getCurrentWindow();

    const setCursorIgnoring = async (ignore: boolean) => {
      if (cursorIgnoringRef.current === ignore) {
        return;
      }

      cursorIgnoringRef.current = ignore;
      try {
        await appWindow.setIgnoreCursorEvents(ignore);
      } catch {
        cursorIgnoringRef.current = !ignore;
      }
    };

    const updateCursorPassthrough = () => {
      if (updateInFlight) {
        return;
      }

      updateInFlight = true;
      void (async () => {
        try {
          if (pointerStart.current) {
            await setCursorIgnoring(false);
            return;
          }

          const interactiveRects = [getInteractiveRect(petButtonRef.current), getInteractiveRect(sparkBubbleRef.current)]
            .filter((rect) => rect !== null);

          if (interactiveRects.length === 0) {
            await setCursorIgnoring(false);
            return;
          }

          const [cursor, windowPosition, scaleFactor] = await Promise.all([
            cursorPosition(),
            appWindow.outerPosition(),
            appWindow.scaleFactor(),
          ]);
          const localCursor = {
            x: (cursor.x - windowPosition.x) / scaleFactor,
            y: (cursor.y - windowPosition.y) / scaleFactor,
          };

          await setCursorIgnoring(!isPointInsideInteractiveRects(localCursor, interactiveRects));
        } finally {
          updateInFlight = false;
        }
      })();
    };

    updateCursorPassthrough();
    const timer = window.setInterval(updateCursorPassthrough, 64);

    return () => {
      window.clearInterval(timer);
      if (cursorIgnoringRef.current) {
        cursorIgnoringRef.current = false;
        void appWindow.setIgnoreCursorEvents(false).catch(() => undefined);
      }
    };
  }, [surfacedSpark]);

  const playReaction = useCallback((reaction: PetState, duration = REACTION_MS) => {
    if (reactionTimer.current !== null) {
      window.clearTimeout(reactionTimer.current);
    }

    setState(reaction);
    if (LOOPING_LOCAL_STATES.has(reaction)) {
      reactionTimer.current = null;
      return;
    }

    reactionTimer.current = window.setTimeout(() => {
      setState("idle");
      reactionTimer.current = null;
    }, duration);
  }, []);

  const showSpark = useCallback((spark: Spark) => {
    if (sparkBubbleTimer.current !== null) {
      window.clearTimeout(sparkBubbleTimer.current);
    }

    setSurfacedSpark(spark);
    sparkBubbleTimer.current = window.setTimeout(() => {
      setSurfacedSpark(null);
      sparkBubbleTimer.current = null;
    }, SPARK_BUBBLE_MS);
  }, []);

  const applyScale = useCallback((scale: number) => {
    setPetScale(clampPetScale(scale));
  }, []);

  const openDashboard = useCallback(async () => {
    if (!isTauriRuntime()) {
      window.open(`${window.location.origin}${window.location.pathname}?view=dashboard`, "cabbagecrow-dashboard");
      return;
    }

    try {
      const dashboard = await TauriWindow.getByLabel("dashboard");
      if (!dashboard) {
        return;
      }
      await dashboard.show();
      await dashboard.setFocus();
    } catch {
      // Dashboard is a nicety; the pet should keep reacting if a window call fails.
    }
  }, []);

  const pullRandomSpark = useCallback(() => {
    const spark = pickRandomSpark(sparksRef.current, previousSparkId.current);
    if (!spark) {
      setSurfacedSpark(null);
      return;
    }

    previousSparkId.current = spark.id;
    showSpark(spark);
    playReaction("review", 1_500);
    const nextSparks = surfaceSpark(sparksRef.current, spark.id);
    sparksRef.current = nextSparks;
    setSparks(nextSparks);
    persistSparks(nextSparks);
  }, [playReaction, showSpark]);

  const addSparkFromShortcut = useCallback(
    (text: string) => {
      const nextSparks = addSpark(sparksRef.current, text);
      if (nextSparks === sparksRef.current) {
        return;
      }

      sparksRef.current = nextSparks;
      setSparks(nextSparks);
      persistSparks(nextSparks);
      playReaction("waving", 700);
    },
    [playReaction],
  );

  const resolveSparkById = useCallback(
    (id: string) => {
      const nextSparks = resolveSpark(sparksRef.current, id);
      sparksRef.current = nextSparks;
      setSparks(nextSparks);
      persistSparks(nextSparks);
      if (surfacedSpark?.id === id) {
        setSurfacedSpark(null);
      }
      playReaction("waving", 700);
    },
    [playReaction, surfacedSpark?.id],
  );

  const updateFreeRange = useCallback(
    (action: "on" | "off" | "toggle") => {
      const current = freeRangeEnabledRef.current;
      const enabled = action === "toggle" ? !current : action === "on";
      freeRangeEnabledRef.current = enabled;
      setFreeRangeEnabled(enabled);
      persistFreeRangeEnabled(enabled);
      playReaction(enabled ? "running" : "waiting", 900);
    },
    [playReaction],
  );

  const applyShortcutUrl = useCallback(
    (url: string) => {
      const command = parseShortcutUrl(url);
      if (!command) {
        return;
      }

      if (command.type === "dashboard") {
        void openDashboard();
        playReaction("review", 900);
        return;
      }

      if (command.type === "free-range") {
        updateFreeRange(command.action);
        return;
      }

      if (command.type === "spark") {
        if (command.action === "pull") {
          pullRandomSpark();
        } else {
          addSparkFromShortcut(command.text);
        }
        return;
      }

      if (command.type === "mode") {
        playReaction(command.state, command.state === "running" || command.state === "idle" ? REACTION_MS : 1100);
        return;
      }

      if (command.action === "set") {
        applyScale(command.scale);
      } else {
        setPetScale((currentScale) => getNextPetScale(currentScale, command.action));
      }
      playReaction("waving", 700);
    },
    [addSparkFromShortcut, applyScale, openDashboard, playReaction, pullRandomSpark, updateFreeRange],
  );

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      unlisten = await listen<string[]>("cabbagecrow-shortcut", (event) => {
        event.payload.forEach(applyShortcutUrl);
      });
      await invoke("frontend_ready");
      const pendingUrls = await invoke<string[]>("drain_pending_shortcuts");
      if (!cancelled) {
        pendingUrls.forEach(applyShortcutUrl);
      }
    })().catch(() => {
      // Deep-link support is only available in the packaged Tauri app.
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [applyShortcutUrl]);

  useEffect(() => {
    const refreshSparks = () => {
      const nextSparks = readSparks();
      sparksRef.current = nextSparks;
      setSparks(nextSparks);
    };
    const refreshSettings = () => {
      const enabled = readFreeRangeEnabled();
      freeRangeEnabledRef.current = enabled;
      setFreeRangeEnabled(enabled);
      setSparkCadence(readSparkCadence());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SPARKS_STORAGE_KEY) {
        refreshSparks();
      }
      if (event.key === FREE_RANGE_STORAGE_KEY || event.key === SPARK_CADENCE_STORAGE_KEY) {
        refreshSettings();
      }
    };

    window.addEventListener(SPARKS_CHANGED_EVENT, refreshSparks);
    window.addEventListener(SETTINGS_CHANGED_EVENT, refreshSettings);
    window.addEventListener("storage", onStorage);

    let unlistenSparks: (() => void) | null = null;
    let unlistenSettings: (() => void) | null = null;
    if (isTauriRuntime()) {
      void listen(SPARKS_CHANGED_EVENT, refreshSparks).then((unlisten) => {
        unlistenSparks = unlisten;
      });
      void listen(SETTINGS_CHANGED_EVENT, refreshSettings).then((unlisten) => {
        unlistenSettings = unlisten;
      });
    }

    return () => {
      window.removeEventListener(SPARKS_CHANGED_EVENT, refreshSparks);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, refreshSettings);
      window.removeEventListener("storage", onStorage);
      unlistenSparks?.();
      unlistenSettings?.();
    };
  }, []);

  useEffect(() => {
    if (!surfacedSpark) {
      return;
    }

    if (!getPendingSparks(sparks).some((spark) => spark.id === surfacedSpark.id)) {
      setSurfacedSpark(null);
    }
  }, [sparks, surfacedSpark]);

  useEffect(() => {
    if (pendingSparkCount === 0) {
      return;
    }

    const timer = window.setInterval(pullRandomSpark, getSparkCadenceMs(sparkCadence));
    return () => window.clearInterval(timer);
  }, [pendingSparkCount, pullRandomSpark, sparkCadence]);

  const startFreeRangeFlight = useCallback(async () => {
    if (!isTauriRuntime() || pointerStart.current) {
      return;
    }

    try {
      const appWindow = getCurrentWindow();
      const monitor = await currentMonitor();
      if (!monitor) {
        return;
      }

      const from = await appWindow.outerPosition();
      const windowSize: PhysicalSize = await appWindow.outerSize();
      const target = chooseFreeRangeTarget(
        {
          x: monitor.position.x,
          y: monitor.position.y,
          width: monitor.size.width,
          height: monitor.size.height,
        },
        windowSize,
      );

      if (freeRangeFlight.current !== null) {
        window.cancelAnimationFrame(freeRangeFlight.current);
      }

      const direction: Direction = target.x >= from.x ? "right" : "left";
      lastDirection.current = direction;
      setState(direction === "right" ? "running-right" : "running-left");
      const startedAt = performance.now();

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / FREE_RANGE_TRAVEL_MS);
        const position = interpolatePosition(from, target, progress);
        void appWindow.setPosition(new PhysicalPosition(position.x, position.y)).catch(() => undefined);

        if (progress < 1 && freeRangeEnabledRef.current) {
          freeRangeFlight.current = window.requestAnimationFrame(tick);
          return;
        }

        freeRangeFlight.current = null;
        setState("idle");
      };

      freeRangeFlight.current = window.requestAnimationFrame(tick);
    } catch {
      // Monitor/position permissions are runtime-only; free range simply pauses if unavailable.
    }
  }, []);

  useEffect(() => {
    if (!freeRangeEnabled || !isTauriRuntime()) {
      if (freeRangeFlight.current !== null) {
        window.cancelAnimationFrame(freeRangeFlight.current);
        freeRangeFlight.current = null;
      }
      return;
    }

    const firstFlight = window.setTimeout(startFreeRangeFlight, 1_200);
    const timer = window.setInterval(startFreeRangeFlight, FREE_RANGE_INTERVAL_MS);
    return () => {
      window.clearTimeout(firstFlight);
      window.clearInterval(timer);
    };
  }, [freeRangeEnabled, startFreeRangeFlight]);

  const startNativeDrag = useCallback(async () => {
    if (!isTauriRuntime()) {
      return;
    }

    try {
      await getCurrentWindow().startDragging();
    } catch {
      // Browser preview and some OS surfaces can reject native drag. The pet still animates.
    }
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (freeRangeFlight.current !== null) {
        window.cancelAnimationFrame(freeRangeFlight.current);
        freeRangeFlight.current = null;
      }

      pointerStart.current = {
        x: event.clientX,
        y: event.clientY,
        scale: petScale,
        resizing: event.shiftKey,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      if (event.shiftKey) {
        event.preventDefault();
        setState("waiting");
        return;
      }

      if (longPressTimer.current !== null) {
        window.clearTimeout(longPressTimer.current);
      }
      longPressTimer.current = window.setTimeout(() => {
        setState("running");
        longPressTimer.current = null;
      }, LONG_PRESS_MS);
      void startNativeDrag();
    },
    [petScale, startNativeDrag],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!pointerStart.current) {
        return;
      }

      if (pointerStart.current.resizing) {
        applyScale(getScaleFromVerticalDrag(pointerStart.current.scale, pointerStart.current.y, event.clientY));
        return;
      }

      if (longPressTimer.current !== null) {
        window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      const direction = getDragDirection(pointerStart.current.x, event.clientX);
      lastDirection.current = direction;
      setState(direction === "right" ? "running-right" : "running-left");
    },
    [applyScale],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (longPressTimer.current !== null) {
        window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (!start) {
        return;
      }

      if (start.resizing) {
        playReaction("waving", 700);
        return;
      }

      const modifiedMode = getModifiedClickMode(event);
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (modifiedMode) {
        playReaction(modifiedMode, modifiedMode === "running" ? 1500 : 1100);
      } else if (moved < 8) {
        playReaction("jumping");
      } else {
        playReaction(lastDirection.current === "right" ? "running-right" : "running-left", 320);
      }
    },
    [playReaction],
  );

  const onDoubleClick = useCallback(() => {
    playReaction("waving", 1100);
  }, [playReaction]);

  const onContextMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      void openDashboard();
      playReaction("review", 1100);
    },
    [openDashboard, playReaction],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        void openDashboard();
        playReaction("review", 900);
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        pullRandomSpark();
        return;
      }

      const resizeCommand = getKeyboardResizeCommand(event.key);
      if (resizeCommand) {
        event.preventDefault();
        setPetScale((currentScale) => getNextPetScale(currentScale, resizeCommand));
        playReaction("waving", 700);
        return;
      }

      const keyboardMode = getKeyboardMode(event.key);
      if (!keyboardMode) {
        return;
      }
      event.preventDefault();
      playReaction(keyboardMode, keyboardMode === "running" || keyboardMode === "idle" ? REACTION_MS : 1100);
    },
    [openDashboard, playReaction, pullRandomSpark],
  );

  if (!pet) {
    return <div className="pet-loading">CabbageCrow is hatching...</div>;
  }

  const cellWidth = pet.cellWidth ?? 192;
  const cellHeight = pet.cellHeight ?? 208;
  const columns = pet.columns ?? 8;
  const style = getFrameStyle(state, frame, { cellWidth, cellHeight });
  const petButtonStyle = { "--pet-scale": getPetButtonScale(petScale) } as CSSProperties;

  return (
    <div className="pet-stack">
      {surfacedSpark && (
        <aside ref={sparkBubbleRef} className="spark-bubble" aria-live="polite">
          <p>{surfacedSpark.text}</p>
          <div className="spark-bubble-actions">
            <button type="button" onClick={() => resolveSparkById(surfacedSpark.id)}>
              Resolve
            </button>
            <button type="button" onClick={() => void openDashboard()}>
              Bucket
            </button>
          </div>
        </aside>
      )}
      <button
        ref={petButtonRef}
        className="pet-button"
        style={petButtonStyle}
        type="button"
        aria-label={`${pet.displayName}: ${pet.description}`}
        onContextMenu={onContextMenu}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span
          className="pet-sprite"
          style={{
            width: style.width,
            height: style.height,
            backgroundImage: `url(${PET_BASE_PATH}/${pet.spritesheetPath})`,
            backgroundPosition: style.backgroundPosition,
            backgroundSize: `${cellWidth * columns}px ${cellHeight * 9}px`,
          }}
        />
      </button>
    </div>
  );
}
