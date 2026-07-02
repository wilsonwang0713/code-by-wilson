import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  $paneStates,
  ensurePaneRegistered,
  togglePane,
  setPaneOpen,
  setPaneWidthOverride,
  clearPaneWidthOverride,
  setPaneHeightOverride,
  clearPaneHeightOverride,
} from "../../src/renderer/src/shell/panes";

describe("pane store", () => {
  beforeEach(() => {
    localStorage.clear();
    $paneStates.set({});
  });

  it("registers a pane once with its default open state", () => {
    ensurePaneRegistered("p", { open: true });
    ensurePaneRegistered("p", { open: false }); // no-op: already registered
    expect($paneStates.get().p).toEqual({
      open: true,
      widthOverride: undefined,
    });
  });
  it("toggles and sets open", () => {
    ensurePaneRegistered("p", { open: true });
    togglePane("p");
    expect($paneStates.get().p.open).toBe(false);
    setPaneOpen("p", true);
    expect($paneStates.get().p.open).toBe(true);
  });
  it("sets and clears a width override", () => {
    ensurePaneRegistered("p", { open: true });
    setPaneWidthOverride("p", 300);
    expect($paneStates.get().p.widthOverride).toBe(300);
    clearPaneWidthOverride("p");
    expect($paneStates.get().p.widthOverride).toBeUndefined();
  });
  it("persists to localStorage", () => {
    ensurePaneRegistered("p", { open: true });
    setPaneWidthOverride("p", 250);
    expect(
      JSON.parse(localStorage.getItem("cbw.paneStates.v1")!).p.widthOverride,
    ).toBe(250);
  });
  it("sets and clears a height override", () => {
    ensurePaneRegistered("p", { open: true });
    setPaneHeightOverride("p", 320);
    expect($paneStates.get().p.heightOverride).toBe(320);
    clearPaneHeightOverride("p");
    expect($paneStates.get().p.heightOverride).toBeUndefined();
  });

  it("drops malformed persisted entries on load", async () => {
    localStorage.setItem(
      "cbw.paneStates.v1",
      JSON.stringify({
        good: { open: true, widthOverride: 250 },
        badOpen: { open: "yes" },
        badWidth: { open: true, widthOverride: "250" },
        notAnObject: 7,
      }),
    );
    vi.resetModules();
    const fresh = await import("../../src/renderer/src/shell/panes");
    expect(fresh.$paneStates.get()).toEqual({
      good: { open: true, widthOverride: 250 },
    });
  });

  it("still reads old-schema snapshots (open + widthOverride only)", async () => {
    localStorage.setItem(
      "cbw.paneStates.v1",
      JSON.stringify({ "cbw-left": { open: false, widthOverride: 300 } }),
    );
    vi.resetModules();
    const fresh = await import("../../src/renderer/src/shell/panes");
    expect(fresh.$paneStates.get()["cbw-left"]).toEqual({
      open: false,
      widthOverride: 300,
    });
  });
});
