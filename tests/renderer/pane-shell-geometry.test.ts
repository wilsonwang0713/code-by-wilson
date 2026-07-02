import { describe, expect, it } from "vitest";
import {
  widthToCss,
  widthToPx,
  paneIsOpen,
  trackForPane,
  heightTrackForPane,
  type CollectedPane,
} from "../../src/renderer/src/shell/pane-shell/geometry";

const pane = (over: Partial<CollectedPane> = {}): CollectedPane => ({
  bottomRow: false,
  defaultOpen: true,
  disabled: false,
  forceCollapsed: false,
  height: "18rem",
  id: "p",
  resizable: true,
  side: "left",
  width: "248px",
  ...over,
});

describe("widthToCss", () => {
  it("passes strings through, suffixes numbers, falls back on undefined", () => {
    expect(widthToCss("16rem", "1px")).toBe("16rem");
    expect(widthToCss(248, "1px")).toBe("248px");
    expect(widthToCss(undefined, "16rem")).toBe("16rem");
  });
});

describe("widthToPx", () => {
  it("resolves px, bare numbers, and numeric strings", () => {
    expect(widthToPx(200)).toBe(200);
    expect(widthToPx("200px")).toBe(200);
    expect(widthToPx("200")).toBe(200);
  });
  it("resolves rem against the root font size", () => {
    expect(widthToPx("2rem")).toBe(32); // jsdom default root font size 16px
  });
  it("resolves vw/% against window width and vh against height", () => {
    expect(widthToPx("50vw")).toBe(window.innerWidth / 2);
    expect(widthToPx("50%")).toBe(window.innerWidth / 2);
    expect(widthToPx("50vh")).toBe(window.innerHeight / 2);
  });
  it("returns undefined for garbage and non-finite numbers", () => {
    expect(widthToPx("abc")).toBeUndefined();
    expect(widthToPx(undefined)).toBeUndefined();
    expect(widthToPx(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe("paneIsOpen / trackForPane", () => {
  it("is open from stored state, falling back to defaultOpen", () => {
    expect(paneIsOpen(pane(), {})).toBe(true);
    expect(paneIsOpen(pane({ defaultOpen: false }), {})).toBe(false);
    expect(paneIsOpen(pane(), { p: { open: false } })).toBe(false);
  });
  it("disabled and forceCollapsed close the rendered track without store writes", () => {
    const states = { p: { open: true } };
    expect(paneIsOpen(pane({ disabled: true }), states)).toBe(false);
    expect(paneIsOpen(pane({ forceCollapsed: true }), states)).toBe(false);
    expect(trackForPane(pane({ forceCollapsed: true }), states)).toEqual({
      open: false,
      track: "0px",
    });
  });
  it("an open track uses the width override only when resizable", () => {
    const states = { p: { open: true, widthOverride: 300 } };
    expect(trackForPane(pane(), states)).toEqual({
      open: true,
      track: "300px",
    });
    expect(trackForPane(pane({ resizable: false }), states)).toEqual({
      open: true,
      track: "248px",
    });
  });
});

describe("heightTrackForPane", () => {
  it("uses the height override only when resizable, else the default height", () => {
    expect(
      heightTrackForPane(pane(), { p: { open: true, heightOverride: 200 } }),
    ).toBe("200px");
    expect(heightTrackForPane(pane({ resizable: false }), {})).toBe("18rem");
  });
});
