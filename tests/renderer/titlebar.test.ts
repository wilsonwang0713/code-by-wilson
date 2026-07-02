import { describe, expect, it } from "vitest";
import {
  TITLEBAR_CONTROL_SIZE,
  TITLEBAR_CONTROLS_TOP,
  TITLEBAR_EDGE_INSET,
  titlebarControlsLeftPx,
  titlebarContentInsetPx,
  headerRightPaddingPx,
} from "../../src/renderer/src/shell/titlebar";

describe("titlebar cluster geometry", () => {
  it("centers the 28px controls in the 40px band", () => {
    expect(TITLEBAR_CONTROL_SIZE).toBe(28);
    expect(TITLEBAR_CONTROLS_TOP).toBe(6);
  });

  it("puts the left cluster after the traffic lights on mac windowed, at the edge otherwise", () => {
    expect(titlebarControlsLeftPx(true, false)).toBe(96);
    expect(titlebarControlsLeftPx(true, true)).toBe(TITLEBAR_EDGE_INSET); // 14
    expect(titlebarControlsLeftPx(false, false)).toBe(TITLEBAR_EDGE_INSET);
    expect(titlebarControlsLeftPx(false, true)).toBe(TITLEBAR_EDGE_INSET);
  });

  it("insets the header past the lights AND the left cluster when the edge is exposed", () => {
    // hermes formula: controls.left + size + round(size / 2)
    expect(titlebarContentInsetPx(true, false)).toBe(96 + 28 + 14); // 138
    expect(titlebarContentInsetPx(true, true)).toBe(14 + 28 + 14); // 56
    expect(titlebarContentInsetPx(false, false)).toBe(56);
  });

  it("reserves room for the right cluster only when it floats over the header", () => {
    expect(headerRightPaddingPx(true)).toBe(14 + 28 + 8); // 50
    expect(headerRightPaddingPx(false)).toBe(16); // HEADER_EDGE_PADDING_PX
  });
});
