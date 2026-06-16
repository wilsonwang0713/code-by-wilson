import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAppSettingsStore } from "../src/main/app-settings";

describe("createAppSettingsStore", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  function tmp(): string {
    const d = mkdtempSync(join(tmpdir(), "cbw-app-settings-"));
    dirs.push(d);
    return d;
  }

  it("reads an empty object when the file is absent", () => {
    expect(createAppSettingsStore({ dir: tmp() }).read()).toEqual({});
  });
  it("persists and reads back the binary-path override", () => {
    const dir = tmp();
    createAppSettingsStore({ dir }).setClaudeBinPath("/custom/claude");
    expect(createAppSettingsStore({ dir }).read().claudeBinPath).toBe(
      "/custom/claude",
    );
  });
  it("clears the override when set to null", () => {
    const dir = tmp();
    const store = createAppSettingsStore({ dir });
    store.setClaudeBinPath("/custom/claude");
    store.setClaudeBinPath(null);
    expect(store.read().claudeBinPath ?? null).toBeNull();
  });
  it("tolerates a corrupt settings file by reading empty", () => {
    const dir = tmp();
    writeFileSync(join(dir, "settings.json"), "{ not json");
    expect(createAppSettingsStore({ dir }).read()).toEqual({});
  });
});
