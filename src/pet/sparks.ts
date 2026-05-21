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

export function addSpark(
  sparks: Spark[],
  text: string,
  now = Date.now(),
  id = crypto.randomUUID(),
): Spark[] {
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

  const choices =
    pending.length > 1 ? pending.filter((spark) => spark.id !== previousSparkId) : pending;
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
