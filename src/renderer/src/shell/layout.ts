import { ensurePaneRegistered } from "./panes";

export const CBW_LEFT_PANE_ID = "cbw-left";
export const CBW_RIGHT_PANE_ID = "cbw-right";

export const LEFT_DEFAULT_WIDTH = 248;
export const LEFT_MIN_WIDTH = 200;
export const LEFT_MAX_WIDTH = 360;
export const RIGHT_DEFAULT_WIDTH = 260;
export const RIGHT_MIN_WIDTH = 220;
export const RIGHT_MAX_WIDTH = 380;

ensurePaneRegistered(CBW_LEFT_PANE_ID, { open: true });
ensurePaneRegistered(CBW_RIGHT_PANE_ID, { open: true });
