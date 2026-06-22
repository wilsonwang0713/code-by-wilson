import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSessionTitleStore } from "../src/main/session-titles";

describe("createSessionTitleStore", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  function tmp(): string {
    const d = mkdtempSync(join(tmpdir(), "cbw-session-titles-"));
    dirs.push(d);
    return d;
  }

  it("reads an empty map when the file is absent", () => {
    expect(createSessionTitleStore({ dir: tmp() }).read()).toEqual({});
  });
  it("persists and reads back a trimmed override", () => {
    const dir = tmp();
    createSessionTitleStore({ dir }).set("abc", "  My Session  ");
    expect(createSessionTitleStore({ dir }).read()).toEqual({
      abc: "My Session",
    });
  });
  it("clears the override when set to null", () => {
    const dir = tmp();
    const store = createSessionTitleStore({ dir });
    store.set("abc", "My Session");
    store.set("abc", null);
    expect(store.read()).toEqual({});
  });
  it("clears the override when set to whitespace", () => {
    const dir = tmp();
    const store = createSessionTitleStore({ dir });
    store.set("abc", "My Session");
    store.set("abc", "   ");
    expect(store.read()).toEqual({});
  });
  it("keeps other overrides when one is cleared", () => {
    const dir = tmp();
    const store = createSessionTitleStore({ dir });
    store.set("a", "Alpha");
    store.set("b", "Beta");
    store.set("a", null);
    expect(store.read()).toEqual({ b: "Beta" });
  });
  it("ignores non-string values in a hand-edited file", () => {
    const dir = tmp();
    writeFileSync(
      join(dir, "session-titles.json"),
      JSON.stringify({ a: "ok", b: 42, c: null }),
    );
    expect(createSessionTitleStore({ dir }).read()).toEqual({ a: "ok" });
  });
  it("tolerates a corrupt file by reading an empty map", () => {
    const dir = tmp();
    writeFileSync(join(dir, "session-titles.json"), "{ not json");
    expect(createSessionTitleStore({ dir }).read()).toEqual({});
  });
});
