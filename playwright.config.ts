import { defineConfig } from "@playwright/test";

/** E2E only — vitest owns the .test.ts files under tests/, playwright owns the .spec.ts files
 *  under tests/e2e/. The specs launch the BUILT app (out/main/index.js), so run `pnpm build`
 *  before `pnpm test:e2e`. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  // One Electron app at a time: the specs assert on global window state.
  workers: 1,
  reporter: "list",
});
