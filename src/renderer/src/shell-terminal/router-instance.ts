import { createShellRouter } from "./router";

/** Built at app startup (module import), so the multiplexed routing is live before any spawn. */
export const shellRouter = createShellRouter(window.api.shellTerminal);
