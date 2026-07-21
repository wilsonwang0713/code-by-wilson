import { describe, it, expect } from "vitest";
import {
  islandBounds,
  ISLAND_WIDTH,
  ISLAND_HEIGHT,
} from "../../src/main/island/position";
import type { DisplayLike } from "../../src/main/island/position";

/** A 14" MacBook Pro-shaped display: the menu bar under the notch is ~37pt tall. */
const NOTCHED: DisplayLike = {
  bounds: { x: 0, y: 0, width: 1512, height: 982 },
  workArea: { x: 0, y: 37, width: 1512, height: 945 },
};

/** A classic external display: 24pt menu bar. */
const FLAT: DisplayLike = {
  bounds: { x: 1512, y: 0, width: 2560, height: 1440 },
  workArea: { x: 1512, y: 24, width: 2560, height: 1416 },
};

describe("islandBounds", () => {
  it("centers the window horizontally in the work area", () => {
    const b = islandBounds(NOTCHED);
    expect(b.x + b.width / 2).toBeCloseTo(
      NOTCHED.workArea.x + NOTCHED.workArea.width / 2,
      0,
    );
    expect(b.width).toBe(ISLAND_WIDTH);
    expect(b.height).toBe(ISLAND_HEIGHT);
  });

  it("pins the window to the top of the work area (just below the menu bar)", () => {
    expect(islandBounds(NOTCHED).y).toBe(37);
    expect(islandBounds(FLAT).y).toBe(24);
  });

  it("centers within a display that does not start at x=0", () => {
    const b = islandBounds(FLAT);
    expect(b.x + b.width / 2).toBeCloseTo(
      FLAT.workArea.x + FLAT.workArea.width / 2,
      0,
    );
  });
});
