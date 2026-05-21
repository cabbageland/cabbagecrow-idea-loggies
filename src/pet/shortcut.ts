import { normalizePetState } from "./animation";
import type { PetState } from "./types";

export type ShortcutCommand =
  | { type: "dashboard"; action: "open" }
  | { type: "free-range"; action: "on" | "off" | "toggle" }
  | { type: "mode"; state: PetState }
  | { type: "spark"; action: "pull" }
  | { type: "spark"; action: "add"; text: string }
  | { type: "size"; action: "up" | "down" | "reset" }
  | { type: "size"; action: "set"; scale: number };

const SIZE_ACTIONS = new Set(["up", "down", "reset"]);
const FREE_RANGE_ACTIONS = new Set(["on", "off", "toggle"]);

function pathSegment(url: URL): string {
  return url.pathname.replace(/^\/+/, "").toLowerCase();
}

export function parseShortcutUrl(rawUrl: string): ShortcutCommand | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "cabbagecrow:") {
    return null;
  }

  const command = url.hostname.toLowerCase();
  const value = pathSegment(url);

  if (command === "mode") {
    const state = normalizePetState(value);
    return state === value ? { type: "mode", state } : null;
  }

  if (command === "size") {
    if (SIZE_ACTIONS.has(value)) {
      return { type: "size", action: value as "up" | "down" | "reset" };
    }

    if (value === "set") {
      const scale = Number.parseFloat(url.searchParams.get("scale") ?? "");
      return Number.isFinite(scale) ? { type: "size", action: "set", scale } : null;
    }
  }

  if (command === "dashboard") {
    return value === "open" ? { type: "dashboard", action: "open" } : null;
  }

  if (command === "free-range") {
    return FREE_RANGE_ACTIONS.has(value)
      ? { type: "free-range", action: value as "on" | "off" | "toggle" }
      : null;
  }

  if (command === "spark") {
    if (value === "pull") {
      return { type: "spark", action: "pull" };
    }

    if (value === "add") {
      const text = url.searchParams.get("text")?.trim();
      return text ? { type: "spark", action: "add", text } : null;
    }
  }

  return null;
}
