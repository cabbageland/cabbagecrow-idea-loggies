import type { Spark } from "./sparks";

export const INSTALL_DATE_STORAGE_KEY = "cabbagecrow.installDate";

export interface IdeaStats {
  added: number;
  resolved: number;
  left: number;
}

export interface InstallDateStorage {
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getIdeaStats(sparks: Spark[]): IdeaStats {
  const resolved = sparks.filter((spark) => spark.resolvedAt !== null).length;
  return {
    added: sparks.length,
    resolved,
    left: sparks.length - resolved,
  };
}

function isValidIsoDate(value: string | null): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function readOrCreateInstallDate(
  storage: InstallDateStorage,
  now = Date.now(),
): string {
  const stored = storage.getItem(INSTALL_DATE_STORAGE_KEY);
  if (isValidIsoDate(stored)) {
    return stored;
  }

  const installDate = new Date(now).toISOString();
  storage.setItem?.(INSTALL_DATE_STORAGE_KEY, installDate);
  return installDate;
}

export function getPetAgeLabel(installDate: string, now = Date.now()): string {
  const installTime = Date.parse(installDate);
  const daysOld = Math.max(0, Math.floor((now - installTime) / DAY_MS));
  return `${daysOld} ${daysOld === 1 ? "day" : "days"} old`;
}

export function formatInstallDate(installDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(installDate));
}
