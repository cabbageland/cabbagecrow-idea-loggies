import { describe, expect, it } from "vitest";
import { parseShortcutUrl } from "./shortcut";

describe("Apple Shortcuts URL commands", () => {
  it("parses mode commands from cabbagecrow URLs", () => {
    expect(parseShortcutUrl("cabbagecrow://mode/review")).toEqual({
      type: "mode",
      state: "review",
    });
    expect(parseShortcutUrl("cabbagecrow://mode/failed")).toEqual({
      type: "mode",
      state: "failed",
    });
  });

  it("parses size commands from cabbagecrow URLs", () => {
    expect(parseShortcutUrl("cabbagecrow://size/up")).toEqual({
      type: "size",
      action: "up",
    });
    expect(parseShortcutUrl("cabbagecrow://size/down")).toEqual({
      type: "size",
      action: "down",
    });
    expect(parseShortcutUrl("cabbagecrow://size/reset")).toEqual({
      type: "size",
      action: "reset",
    });
  });

  it("parses explicit size values", () => {
    expect(parseShortcutUrl("cabbagecrow://size/set?scale=1.45")).toEqual({
      type: "size",
      action: "set",
      scale: 1.45,
    });
  });

  it("parses dashboard and free range commands", () => {
    expect(parseShortcutUrl("cabbagecrow://dashboard/open")).toEqual({
      type: "dashboard",
      action: "open",
    });
    expect(parseShortcutUrl("cabbagecrow://free-range/toggle")).toEqual({
      type: "free-range",
      action: "toggle",
    });
    expect(parseShortcutUrl("cabbagecrow://free-range/on")).toEqual({
      type: "free-range",
      action: "on",
    });
  });

  it("parses spark commands", () => {
    expect(parseShortcutUrl("cabbagecrow://spark/pull")).toEqual({
      type: "spark",
      action: "pull",
    });
    expect(parseShortcutUrl("cabbagecrow://spark/add?text=Tiny%20ritual")).toEqual({
      type: "spark",
      action: "add",
      text: "Tiny ritual",
    });
  });

  it("rejects unknown or unsafe shortcut URLs", () => {
    expect(parseShortcutUrl("https://example.com/size/up")).toBeNull();
    expect(parseShortcutUrl("cabbagecrow://mode/sleep")).toBeNull();
    expect(parseShortcutUrl("cabbagecrow://size/set?scale=huge")).toBeNull();
    expect(parseShortcutUrl("cabbagecrow://free-range/maybe")).toBeNull();
    expect(parseShortcutUrl("cabbagecrow://spark/add")).toBeNull();
  });
});
