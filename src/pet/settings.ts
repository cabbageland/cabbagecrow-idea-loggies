export const FREE_RANGE_STORAGE_KEY = "cabbagecrow.freeRangeEnabled";
export const SPARK_CADENCE_STORAGE_KEY = "cabbagecrow.sparkCadence";

export type SparkCadence = "gentle" | "normal" | "frequent";

const SPARK_CADENCE_MS: Record<SparkCadence, number> = {
  gentle: 45_000,
  normal: 25_000,
  frequent: 12_000,
};

export function normalizeSparkCadence(value: string | null): SparkCadence {
  if (value === "normal" || value === "frequent") {
    return value;
  }

  return "gentle";
}

export function getSparkCadenceMs(cadence: SparkCadence): number {
  return SPARK_CADENCE_MS[cadence];
}

export function readStoredBoolean(storage: Storage, key: string, fallback: boolean): boolean {
  const value = storage.getItem(key);
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}
