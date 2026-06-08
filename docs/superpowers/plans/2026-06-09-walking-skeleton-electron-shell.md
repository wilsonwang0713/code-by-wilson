# Walking Skeleton: Electron Shell + One Live Session as a Row — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the real Electron app (electron-vite: main + preload + React renderer) so that launching it shows one row per currently-running Claude Code Session, each row served from SQLite, parsed by a `ClaudeProvider` that maps `~/.claude` data into the app's normalized model.

**Architecture:** A pure-Node `ClaudeProvider` discovers running Sessions from `~/.claude/sessions/*.json` (filtered by a live-pid check), reads each Session's Transcript for title/project/branch/model/last-activity, and returns normalized `Session` objects. The Electron main process writes that snapshot into an embedded SQLite index on launch, then serves rows back to the React renderer over typed IPC. The renderer consumes only normalized types, never Claude-native shapes. The Provider's parsing core is pure data-in/data-out and is the one thing covered by unit tests, over a redacted `~/.claude` fixture tree.

**Tech Stack:** Electron, electron-vite, React 19 + TypeScript, Tailwind v4 (existing monochrome tokens), better-sqlite3 (main process only), Vitest. Package manager is **pnpm** (v10). This is a `darwin` machine with Xcode CLT, Python 3, and make available for the native rebuild.

---

## Scope Boundaries (read before building)

This is issue **#2**, the walking skeleton. It builds the end-to-end spine and nothing more. The normalized `Session` type has many fields; the skeleton populates only what issue #2 explicitly calls for and fills the rest with honest, clearly-marked defaults that later issues replace. **Do not build these here:**

| Concern | Skeleton behavior | Owned by |
|---|---|---|
| Real state derivation (waiting/idle/ended nuance) | Minimal: session file `status === 'busy'` → `working`, else `idle`. All discovered sessions are alive. | issue #3 |
| Incremental sync + Ended/recent sessions | Full-replace snapshot of *running* sessions only, on launch + manual refresh. | issue #4 |
| Per-session tokens, cost, context % | `usage` zeros, `equivApiValueUsd` 0, `contextPct` 0, `contextWindow` per-model constant. | issue #5 |
| SettingsManager / statusLine / rate limits | Not touched. `hasRateLimits` flag is advertised but no statusLine is installed. | issues #6, #11 |
| Managed sessions / spawning / PTY | Every discovered session is `management: 'observed'`. | issue #8 |
| Tasks + Subagent tree parsing | `tasks: []`, `subagents: []`. | issue #13 |
| Folding prototype variant B into the real Overview | The bare Overview here is a plain legible table, not variant B. `src/prototype/` stays dormant. | issue #10 |

Keep `~/.claude` data shapes out of the renderer. The renderer imports only from `@shared/*`.

---

## File Structure

The current repo is a plain Vite + React browser prototype. This plan converts it to the standard electron-vite three-process layout. New and moved files:

```
electron.vite.config.ts          NEW  — main/preload/renderer build config (replaces vite.config.ts)
vitest.config.ts                 NEW  — Node-env test runner, @shared alias
tsconfig.json                    EDIT — solution file referencing the two below
tsconfig.node.json               NEW  — main + preload + shared + tests (node lib)
tsconfig.web.json                NEW  — renderer + shared (DOM lib, react-jsx)
package.json                     EDIT — deps, scripts, main field, pnpm.onlyBuiltDependencies, drop "type":"module"
.gitignore                       EDIT — add out/

src/
  shared/                        NEW  — the normalized model + IPC contract (imported by main AND renderer)
    models.ts                    NEW  — ModelId list, normalizeModelId(), contextWindowFor()
    types.ts                     NEW  — Session, Usage, Task, Subagent, RateLimit, Account, ProviderCapabilities
    ipc.ts                       NEW  — IPC channel names + IpcApi interface
  main/                          NEW  — Electron main process (CJS output, node runtime)
    index.ts                     NEW  — app lifecycle, BrowserWindow, sync-on-launch
    ipc.ts                       NEW  — ipcMain handlers (list/refresh/capabilities) + sync()
    db/
      index.ts                   NEW  — openDb, replaceSessions, getSessions (better-sqlite3)
    provider/
      types.ts                   NEW  — Provider interface
      claude/
        transcript.ts            NEW  — parseTranscript(), deriveTitle()  [pure]
        discover.ts              NEW  — readSessionFiles, findTranscriptPath, discoverSessions  [pure]
        index.ts                 NEW  — createClaudeProvider() facade + real pid-liveness
  preload/
    index.ts                     NEW  — contextBridge bridge exposing window.api
  renderer/
    index.html                   NEW  — renderer entry (moved/rewritten from root index.html)
    src/
      main.tsx                   NEW  — mounts <App/> (rewritten from src/main.tsx)
      App.tsx                    NEW  — the bare Overview table + capability footer + Refresh
      index.css                  MOVE — from src/index.css (dark theme tokens preserved)
      vite-env.d.ts              MOVE — from src/vite-env.d.ts
      api.d.ts                   NEW  — global Window.api typing
  prototype/                     UNCHANGED — dormant, throwaway; issue #10 harvests + deletes it

tests/
  fixtures/claude-home/          NEW  — redacted ~/.claude mirror
    sessions/1001.json
    sessions/1002.json
    sessions/1003.json
    projects/-work-code-by-wire/aaaa1111-1111-1111-1111-111111111111.jsonl
    projects/-work-api-service/cccc3333-3333-3333-3333-333333333333.jsonl
  provider/
    models.test.ts               NEW
    transcript.test.ts           NEW
    discover.test.ts             NEW
    provider.test.ts             NEW

DELETED: vite.config.ts, src/main.tsx, src/index.css, src/vite-env.d.ts, root index.html
```

**Why this split:** the Provider parsing (`transcript.ts`, `discover.ts`) is pure and is the entire test surface, so it lives apart from anything that touches Electron or SQLite. The DB layer and IPC are thin glue verified by launching the app, not by unit tests — keeping native `better-sqlite3` out of the Vitest (Node-ABI) process entirely, since it's rebuilt for Electron's ABI. `src/shared` is the only code both main and renderer import; it carries zero runtime dependencies the renderer shouldn't have.

---

## Task 1: Dependencies and package.json

Convert the project from a browser Vite app to an electron-vite app: add Electron, electron-vite, better-sqlite3, Vitest, and the native-rebuild tooling. pnpm v10 does **not** run dependency build scripts by default, so Electron won't download its binary and better-sqlite3 won't build unless they're in `pnpm.onlyBuiltDependencies`.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace `package.json` wholesale**

Note the removal of `"type": "module"` — electron-vite emits the main and preload processes as CommonJS (`.js`), and a module-type package would make Node treat those as ESM and break `__dirname`. The renderer is bundled by Vite and is unaffected.

```json
{
  "name": "code-by-wire",
  "private": true,
  "version": "0.0.0",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "start": "electron-vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "rebuild:native": "electron-rebuild -f -w better-sqlite3"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.7.0",
    "@tailwindcss/vite": "^4.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "electron": "^33.0.0",
    "electron-vite": "^2.3.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3", "electron", "esbuild"]
  }
}
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: completes with `Done in …`. pnpm builds `better-sqlite3`, `electron`, and `esbuild` (they're approved via `onlyBuiltDependencies`). If you see a warning like `Ignored build scripts: better-sqlite3, electron`, the `pnpm` block didn't take — re-check `package.json` and run `pnpm install` again, or run `pnpm approve-builds` and select all.

- [ ] **Step 3: Rebuild better-sqlite3 for Electron's ABI**

better-sqlite3's prebuilt binary targets Node, but it runs in Electron's main process, which has a different ABI. Rebuild it:

Run: `pnpm rebuild:native`
Expected: ends with `✔ Rebuild Complete`. (Re-run this any time the `electron` version changes.)

- [ ] **Step 4: Verify the toolchain is present**

Run: `pnpm exec electron-vite --version && pnpm exec vitest --version`
Expected: prints two version numbers, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: switch to electron-vite + better-sqlite3 + vitest toolchain"
```

---

## Task 2: Electron-vite layout, config, and a launching window

Move the renderer into the electron-vite structure, write the build config and TypeScript configs, and stand up a minimal main/preload/renderer that opens a window. This proves the Electron spine before any data flows. No `@shared`, no SQLite yet.

**Files:**
- Create: `electron.vite.config.ts`, `tsconfig.node.json`, `tsconfig.web.json`, `vitest.config.ts`
- Modify: `tsconfig.json`, `.gitignore`
- Create: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`
- Move: `src/index.css` → `src/renderer/src/index.css`, `src/vite-env.d.ts` → `src/renderer/src/vite-env.d.ts`
- Delete: `vite.config.ts`, `src/main.tsx`, root `index.html`

- [ ] **Step 1: Write `electron.vite.config.ts`**

`better-sqlite3` is a native addon and cannot be bundled, so it's marked external in the main build. The React and Tailwind plugins apply only to the renderer.

```typescript
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: { external: ['better-sqlite3'] },
    },
    resolve: {
      alias: { '@shared': resolve('src/shared') },
    },
  },
  preload: {
    resolve: {
      alias: { '@shared': resolve('src/shared') },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer/src'),
      },
    },
    build: {
      rollupOptions: { input: { index: resolve('src/renderer/index.html') } },
    },
  },
})
```

- [ ] **Step 2: Write the three tsconfigs**

Replace `tsconfig.json` with a solution file (for editor per-file routing), and add a node config and a web config. `pnpm typecheck` runs each independently, so `src/shared` is typechecked under both.

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  },
  "include": [
    "src/main",
    "src/preload",
    "src/shared",
    "tests",
    "electron.vite.config.ts",
    "vitest.config.ts"
  ]
}
```

`tsconfig.web.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@renderer/*": ["src/renderer/src/*"]
    }
  },
  "include": ["src/renderer/src", "src/shared"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

Tests run in a Node environment and only import the pure Provider modules. The `@shared` alias must resolve here too.

```typescript
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@shared': resolve('src/shared') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Add `out/` to `.gitignore`**

electron-vite builds to `out/`. Add it under the existing `dist-electron/` line:

```
node_modules/
dist/
dist-electron/
out/
*.local
.DS_Store
.vite/

# Vendored Claude Code skills — reproducible from skills-lock.json via /setup-matt-pocock-skills
.claude/skills/
```

- [ ] **Step 5: Move the renderer-owned files**

```bash
mkdir -p src/renderer/src
git mv src/index.css src/renderer/src/index.css
git mv src/vite-env.d.ts src/renderer/src/vite-env.d.ts
```

(`src/renderer/src/index.css` keeps the existing dark-theme `@theme` tokens unchanged. `src/renderer/src/vite-env.d.ts` keeps its single `/// <reference types="vite/client" />` line.)

- [ ] **Step 6: Write `src/renderer/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>code-by-wire</title>
  </head>
  <body class="app-bg">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Write `src/renderer/src/main.tsx` (placeholder for now)**

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ padding: 24, color: 'var(--color-fg)' }}>code-by-wire — shell up</div>
  </React.StrictMode>,
)
```

- [ ] **Step 8: Write `src/main/index.ts` (minimal — opens a window)**

```typescript
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    backgroundColor: '#141413',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 9: Write `src/preload/index.ts` (minimal placeholder)**

```typescript
import { contextBridge } from 'electron'

// The real window.api bridge is wired in the IPC task. This keeps the
// preload bundle present so the window has a preload to load.
contextBridge.exposeInMainWorld('api', {})
```

- [ ] **Step 10: Delete the old browser-app entry files**

```bash
git rm vite.config.ts src/main.tsx index.html
```

- [ ] **Step 11: Launch it**

Run: `pnpm dev`
Expected: electron-vite builds main/preload/renderer and an Electron window opens showing **"code-by-wire — shell up"** on a dark background. Quit the app (Cmd+Q) to stop.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: electron-vite shell with main, preload, and renderer"
```

---

## Task 3: Shared normalized model

Promote the prototype's throwaway types into the real shared model that both the Provider (main) and the Overview (renderer) consume. The model helpers (`normalizeModelId`, `contextWindowFor`) are pure and get a unit test; the type and IPC modules are verified by `pnpm typecheck`.

**Files:**
- Create: `src/shared/models.ts`, `src/shared/types.ts`, `src/shared/ipc.ts`
- Test: `tests/provider/models.test.ts`

- [ ] **Step 1: Write the failing test for the model helpers**

`tests/provider/models.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { normalizeModelId, contextWindowFor } from '@shared/models'

describe('normalizeModelId', () => {
  it('maps known model strings to canonical ids', () => {
    expect(normalizeModelId('claude-opus-4-8')).toBe('claude-opus-4-8')
    expect(normalizeModelId('claude-sonnet-4-6')).toBe('claude-sonnet-4-6')
    expect(normalizeModelId('claude-haiku-4-5')).toBe('claude-haiku-4-5')
  })

  it('tolerates suffixes and unknowns by family, defaulting to opus', () => {
    expect(normalizeModelId('claude-opus-4-8[1m]')).toBe('claude-opus-4-8')
    expect(normalizeModelId(undefined)).toBe('claude-opus-4-8')
    expect(normalizeModelId('something-weird')).toBe('claude-opus-4-8')
  })
})

describe('contextWindowFor', () => {
  it('returns a positive token window for every model', () => {
    expect(contextWindowFor('claude-sonnet-4-6')).toBe(200_000)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test`
Expected: FAIL — `Failed to resolve import "@shared/models"` (module doesn't exist yet).

- [ ] **Step 3: Write `src/shared/models.ts`**

```typescript
export const MODEL_IDS = [
  'claude-opus-4-8',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
] as const

export type ModelId = (typeof MODEL_IDS)[number]

/** Map a raw transcript model string (possibly suffixed, e.g. "[1m]") to a canonical ModelId. */
export function normalizeModelId(raw: string | undefined): ModelId {
  if (!raw) return 'claude-opus-4-8'
  if (raw.includes('opus')) return 'claude-opus-4-8'
  if (raw.includes('sonnet')) return 'claude-sonnet-4-6'
  if (raw.includes('haiku')) return 'claude-haiku-4-5'
  return 'claude-opus-4-8'
}

/**
 * Token context window for a model. The skeleton uses a single baseline; real
 * per-model and 1M-variant windows arrive with context % work (issue #5).
 */
export function contextWindowFor(_model: ModelId): number {
  return 200_000
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm test`
Expected: PASS — 1 test file, 3 tests passing.

- [ ] **Step 5: Write `src/shared/types.ts`**

This is the normalized contract from issue #2 / ADR-0003. The renderer never sees anything else.

```typescript
import type { ModelId } from './models'

export type { ModelId }

export type SessionState = 'working' | 'waiting' | 'idle' | 'ended'
export type Management = 'managed' | 'observed'

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

export interface Task {
  id: string
  subject: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  blockedBy?: string[]
}

export interface Subagent {
  id: string
  type: string
  status: 'working' | 'done' | 'failed'
  model: ModelId
  tokens: number
  durationMs: number
  children?: Subagent[]
}

export interface Session {
  id: string
  title: string
  project: string
  branch?: string
  state: SessionState
  management: Management
  model: ModelId
  contextPct: number
  contextWindow: number
  usage: Usage
  equivApiValueUsd: number
  lastActivityMs: number
  currentTask?: string
  waitingReason?: string
  tasks: Task[]
  subagents: Subagent[]
}

export interface RateLimit {
  usedPct: number
  resetsAt: number
}

export interface Account {
  billingMode: 'subscription' | 'api'
  plan: string
  fiveHour: RateLimit
  sevenDay: RateLimit
}

/** What a Provider can do. Drives graceful degradation in the UI (ADR-0003). */
export interface ProviderCapabilities {
  canControl: boolean
  hasRateLimits: boolean
  hasSubagents: boolean
}
```

- [ ] **Step 6: Write `src/shared/ipc.ts`**

Channel names and the typed surface live together so main and preload can't drift.

```typescript
import type { Session, ProviderCapabilities } from './types'

export const IPC = {
  listSessions: 'sessions:list',
  refresh: 'sessions:refresh',
  capabilities: 'provider:capabilities',
} as const

export interface IpcApi {
  listSessions(): Promise<Session[]>
  refresh(): Promise<Session[]>
  capabilities(): Promise<ProviderCapabilities>
}
```

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm typecheck`
Expected: no output, exit 0.

```bash
git add src/shared tests/provider/models.test.ts
git commit -m "feat: shared normalized model, model helpers, and IPC contract"
```

---

## Task 4: Transcript parsing (pure)

Parse one Session's Transcript (`.jsonl`) into a summary: title, project, branch, model, last-activity. This is the highest-risk parsing in the skeleton, so it gets the most direct tests. Build the redacted fixtures here too.

**Files:**
- Create: `tests/fixtures/claude-home/projects/-work-code-by-wire/aaaa1111-1111-1111-1111-111111111111.jsonl`
- Create: `tests/fixtures/claude-home/projects/-work-api-service/cccc3333-3333-3333-3333-333333333333.jsonl`
- Create: `src/main/provider/claude/transcript.ts`
- Test: `tests/provider/transcript.test.ts`

- [ ] **Step 1: Create the two Transcript fixtures**

These mirror real `~/.claude` transcript lines (a `user` line carries `cwd`/`gitBranch`/`timestamp` and string content; an `assistant` line carries `message.model` and `message.usage`), redacted to tiny synthetic content.

`tests/fixtures/claude-home/projects/-work-code-by-wire/aaaa1111-1111-1111-1111-111111111111.jsonl`:
```
{"type":"user","isMeta":false,"cwd":"/work/code-by-wire","gitBranch":"feature/login","timestamp":"2026-06-08T22:53:40.000Z","message":{"role":"user","content":"Add a login form to the settings page"}}
{"type":"assistant","cwd":"/work/code-by-wire","gitBranch":"feature/login","timestamp":"2026-06-08T22:54:06.078Z","message":{"role":"assistant","model":"claude-sonnet-4-6","usage":{"input_tokens":100,"output_tokens":50,"cache_read_input_tokens":10,"cache_creation_input_tokens":5}}}
```

`tests/fixtures/claude-home/projects/-work-api-service/cccc3333-3333-3333-3333-333333333333.jsonl` — first real prompt is a slash command (tests tag-stripping); the last line is intentionally malformed (tests tolerance of a partially-written live transcript):
```
{"type":"user","isMeta":true,"cwd":"/work/api-service","gitBranch":"main","timestamp":"2026-06-08T20:00:00.000Z","message":{"role":"user","content":"ignored meta line"}}
{"type":"user","isMeta":false,"cwd":"/work/api-service","gitBranch":"main","timestamp":"2026-06-08T20:01:00.000Z","message":{"role":"user","content":"<command-name>deploy</command-name>"}}
{"type":"assistant","cwd":"/work/api-service","gitBranch":"main","timestamp":"2026-06-08T20:02:00.000Z","message":{"role":"assistant","model":"claude-opus-4-8"}}
{ this trailing line is not valid json
```

- [ ] **Step 2: Write the failing test**

`tests/provider/transcript.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseTranscript, deriveTitle } from '../../src/main/provider/claude/transcript'

const fx = (p: string) => readFileSync(resolve('tests/fixtures/claude-home', p), 'utf8')

describe('parseTranscript', () => {
  it('extracts title, project, branch, model, and last activity', () => {
    const s = parseTranscript(
      fx('projects/-work-code-by-wire/aaaa1111-1111-1111-1111-111111111111.jsonl'),
    )
    expect(s.title).toBe('Add a login form to the settings page')
    expect(s.project).toBe('code-by-wire')
    expect(s.cwd).toBe('/work/code-by-wire')
    expect(s.branch).toBe('feature/login')
    expect(s.model).toBe('claude-sonnet-4-6')
    expect(s.lastActivityMs).toBe(Date.parse('2026-06-08T22:54:06.078Z'))
  })

  it('strips slash-command wrappers, skips meta lines, and tolerates malformed json', () => {
    const s = parseTranscript(
      fx('projects/-work-api-service/cccc3333-3333-3333-3333-333333333333.jsonl'),
    )
    expect(s.title).toBe('deploy')
    expect(s.model).toBe('claude-opus-4-8')
    expect(s.project).toBe('api-service')
    expect(s.branch).toBe('main')
  })
})

describe('deriveTitle', () => {
  it('falls back to the project basename when there is no prose', () => {
    expect(deriveTitle([], '/work/empty-proj')).toBe('empty-proj')
  })

  it('skips empty prompts and picks the first real one', () => {
    expect(
      deriveTitle(['<command-message></command-message>', '   ', 'Fix the timeout bug'], '/x/y'),
    ).toBe('Fix the timeout bug')
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm test`
Expected: FAIL — `Failed to resolve import` for `transcript` (module doesn't exist).

- [ ] **Step 4: Write `src/main/provider/claude/transcript.ts`**

```typescript
import { basename } from 'node:path'
import { normalizeModelId, type ModelId } from '@shared/models'

export interface TranscriptSummary {
  title: string
  project: string
  cwd: string
  branch?: string
  model: ModelId
  lastActivityMs: number
}

/** First non-empty user prompt with tags stripped, else the project basename. */
export function deriveTitle(userPrompts: string[], cwd: string): string {
  for (const raw of userPrompts) {
    const cleaned = raw
      .replace(/<[^>]+>/g, '') // drop slash-command / tag wrappers, keep inner text
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned) return cleaned.length > 80 ? cleaned.slice(0, 79) + '…' : cleaned
  }
  return basename(cwd) || 'session'
}

/**
 * Reduce a transcript's JSONL into a normalized summary. Parses line by line and
 * skips any unparseable line, so a transcript being appended to right now (a
 * half-written trailing line) is fine.
 */
export function parseTranscript(jsonl: string, fallbackCwd = ''): TranscriptSummary {
  let cwd = fallbackCwd
  let branch: string | undefined
  let lastModelRaw: string | undefined
  let lastActivityMs = 0
  const userPrompts: string[] = []

  for (const line of jsonl.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let row: any
    try {
      row = JSON.parse(trimmed)
    } catch {
      continue
    }

    if (typeof row.cwd === 'string') cwd = row.cwd
    if (typeof row.gitBranch === 'string') branch = row.gitBranch

    if (typeof row.timestamp === 'string') {
      const ms = Date.parse(row.timestamp)
      if (!Number.isNaN(ms) && ms > lastActivityMs) lastActivityMs = ms
    }

    if (row.type === 'assistant' && typeof row.message?.model === 'string') {
      lastModelRaw = row.message.model
    }

    if (row.type === 'user' && !row.isMeta && typeof row.message?.content === 'string') {
      userPrompts.push(row.message.content)
    }
  }

  return {
    title: deriveTitle(userPrompts, cwd),
    project: basename(cwd) || 'unknown',
    cwd,
    branch,
    model: normalizeModelId(lastModelRaw),
    lastActivityMs,
  }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm test`
Expected: PASS — `transcript.test.ts` green (4 tests), `models.test.ts` still green.

- [ ] **Step 6: Commit**

```bash
git add src/main/provider/claude/transcript.ts tests/provider/transcript.test.ts tests/fixtures
git commit -m "feat: parse a Claude transcript into a normalized summary"
```

---

## Task 5: Session discovery (pure)

Read `~/.claude/sessions/*.json`, keep the ones whose pid is alive (the liveness check is injected so it's testable), locate each Session's Transcript, and assemble normalized `Session` objects. This is where the issue #2 scope defaults live (observed, zeroed usage/cost/context, empty tasks/subagents, minimal state).

**Files:**
- Create: `tests/fixtures/claude-home/sessions/1001.json`, `.../1002.json`, `.../1003.json`
- Create: `src/main/provider/claude/discover.ts`
- Test: `tests/provider/discover.test.ts`

- [ ] **Step 1: Create the session-file fixtures**

Three running sessions as Claude writes them (keyed by pid in the filename, pid + sessionId + cwd + status inside). 1001 has a matching transcript (Task 4 fixture); 1002 is a stale entry whose process is dead; 1003 maps to the api-service transcript.

`tests/fixtures/claude-home/sessions/1001.json`:
```json
{"pid":1001,"sessionId":"aaaa1111-1111-1111-1111-111111111111","cwd":"/work/code-by-wire","startedAt":1780959200000,"status":"busy","updatedAt":1780959246078,"version":"2.1.169","kind":"interactive"}
```

`tests/fixtures/claude-home/sessions/1002.json`:
```json
{"pid":1002,"sessionId":"bbbb2222-2222-2222-2222-222222222222","cwd":"/work/old-thing","status":"idle","updatedAt":1780950000000}
```

`tests/fixtures/claude-home/sessions/1003.json`:
```json
{"pid":1003,"sessionId":"cccc3333-3333-3333-3333-333333333333","cwd":"/work/api-service","status":"idle","updatedAt":1780959300000}
```

- [ ] **Step 2: Write the failing test**

`tests/provider/discover.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { discoverSessions } from '../../src/main/provider/claude/discover'

const CLAUDE_DIR = resolve('tests/fixtures/claude-home')

describe('discoverSessions', () => {
  it('includes only sessions whose pid is alive', () => {
    const alive = new Set([1001, 1003])
    const sessions = discoverSessions({
      claudeDir: CLAUDE_DIR,
      isPidAlive: (pid) => alive.has(pid),
    })
    const ids = sessions.map((s) => s.id).sort()
    expect(ids).toEqual([
      'aaaa1111-1111-1111-1111-111111111111',
      'cccc3333-3333-3333-3333-333333333333',
    ])
  })

  it('maps a live session into the normalized model with skeleton defaults', () => {
    const sessions = discoverSessions({ claudeDir: CLAUDE_DIR, isPidAlive: () => true })
    const a = sessions.find((s) => s.id === 'aaaa1111-1111-1111-1111-111111111111')!

    expect(a.title).toBe('Add a login form to the settings page')
    expect(a.project).toBe('code-by-wire')
    expect(a.branch).toBe('feature/login')
    expect(a.model).toBe('claude-sonnet-4-6')
    expect(a.management).toBe('observed')
    expect(a.state).toBe('working') // status "busy"
    expect(a.lastActivityMs).toBe(Date.parse('2026-06-08T22:54:06.078Z'))

    // issue #2 scope defaults
    expect(a.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    })
    expect(a.equivApiValueUsd).toBe(0)
    expect(a.contextPct).toBe(0)
    expect(a.contextWindow).toBe(200_000)
    expect(a.tasks).toEqual([])
    expect(a.subagents).toEqual([])
  })

  it('derives idle for non-busy sessions', () => {
    const sessions = discoverSessions({ claudeDir: CLAUDE_DIR, isPidAlive: () => true })
    const c = sessions.find((s) => s.id === 'cccc3333-3333-3333-3333-333333333333')!
    expect(c.state).toBe('idle')
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm test`
Expected: FAIL — `Failed to resolve import` for `discover`.

- [ ] **Step 4: Write `src/main/provider/claude/discover.ts`**

```typescript
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Session, SessionState } from '@shared/types'
import { contextWindowFor, normalizeModelId } from '@shared/models'
import { parseTranscript, type TranscriptSummary } from './transcript'

export interface RawSessionFile {
  pid: number
  sessionId: string
  cwd: string
  status?: string
  updatedAt?: number
}

export interface DiscoverDeps {
  claudeDir: string
  isPidAlive: (pid: number) => boolean
}

/** Read every well-formed `sessions/*.json`, skipping malformed files. */
export function readSessionFiles(claudeDir: string): RawSessionFile[] {
  const dir = join(claudeDir, 'sessions')
  if (!existsSync(dir)) return []

  const out: RawSessionFile[] = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    try {
      const j = JSON.parse(readFileSync(join(dir, name), 'utf8'))
      if (typeof j.pid === 'number' && typeof j.sessionId === 'string') {
        out.push({
          pid: j.pid,
          sessionId: j.sessionId,
          cwd: typeof j.cwd === 'string' ? j.cwd : '',
          status: j.status,
          updatedAt: j.updatedAt,
        })
      }
    } catch {
      // skip malformed session file
    }
  }
  return out
}

/** Find `projects/<encoded>/<sessionId>.jsonl` without depending on the cwd→dir encoding. */
export function findTranscriptPath(claudeDir: string, sessionId: string): string | null {
  const projects = join(claudeDir, 'projects')
  if (!existsSync(projects)) return null

  for (const proj of readdirSync(projects)) {
    const candidate = join(projects, proj, `${sessionId}.jsonl`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function discoverSessions({ claudeDir, isPidAlive }: DiscoverDeps): Session[] {
  return readSessionFiles(claudeDir)
    .filter((s) => isPidAlive(s.pid))
    .map((s) => {
      const path = findTranscriptPath(claudeDir, s.sessionId)
      const summary = path ? parseTranscript(readFileSync(path, 'utf8'), s.cwd) : null
      return toSession(s, summary)
    })
}

/** Minimal skeleton state. Full Working/Waiting/Idle/Ended derivation is issue #3. */
function deriveState(status: string | undefined): SessionState {
  return status === 'busy' ? 'working' : 'idle'
}

function toSession(s: RawSessionFile, t: TranscriptSummary | null): Session {
  const model = t ? t.model : normalizeModelId(undefined)
  const projectFromCwd = s.cwd ? basename(s.cwd) : 'unknown'

  return {
    id: s.sessionId,
    title: t?.title ?? projectFromCwd,
    project: t?.project ?? projectFromCwd,
    branch: t?.branch,
    state: deriveState(s.status),
    management: 'observed', // managed sessions arrive with spawning (issue #8)
    model,
    contextPct: 0, // issue #5
    contextWindow: contextWindowFor(model),
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }, // issue #5
    equivApiValueUsd: 0, // issue #5
    lastActivityMs: t?.lastActivityMs || s.updatedAt || 0,
    tasks: [], // issue #13
    subagents: [], // issue #13
  }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm test`
Expected: PASS — `discover.test.ts` green (3 tests), all prior tests still green.

- [ ] **Step 6: Commit**

```bash
git add src/main/provider/claude/discover.ts tests/provider/discover.test.ts tests/fixtures/claude-home/sessions
git commit -m "feat: discover running sessions and normalize them"
```

---

## Task 6: ClaudeProvider facade

Wrap discovery behind the `Provider` interface with capability flags and a real pid-liveness check. The default `claudeDir` is `~/.claude`; both deps are injectable so the facade is testable over the fixtures.

**Files:**
- Create: `src/main/provider/types.ts`
- Create: `src/main/provider/claude/index.ts`
- Test: `tests/provider/provider.test.ts`

- [ ] **Step 1: Write `src/main/provider/types.ts`**

```typescript
import type { Session, ProviderCapabilities } from '@shared/types'

export interface Provider {
  readonly id: string
  readonly capabilities: ProviderCapabilities
  listSessions(): Promise<Session[]>
}
```

- [ ] **Step 2: Write the failing test**

`tests/provider/provider.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { createClaudeProvider } from '../../src/main/provider/claude'

describe('ClaudeProvider', () => {
  it('exposes capability flags and lists normalized sessions', async () => {
    const provider = createClaudeProvider({
      claudeDir: resolve('tests/fixtures/claude-home'),
      isPidAlive: (pid) => pid === 1001,
    })

    expect(provider.id).toBe('claude')
    expect(provider.capabilities).toEqual({
      canControl: true,
      hasRateLimits: true,
      hasSubagents: true,
    })

    const sessions = await provider.listSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('aaaa1111-1111-1111-1111-111111111111')
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm test`
Expected: FAIL — `Failed to resolve import` for `../../src/main/provider/claude`.

- [ ] **Step 4: Write `src/main/provider/claude/index.ts`**

```typescript
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Provider } from '../types'
import { discoverSessions } from './discover'

export interface ClaudeProviderDeps {
  claudeDir?: string
  isPidAlive?: (pid: number) => boolean
}

/** A pid is alive if signalling it succeeds, or fails only because we lack permission. */
function defaultIsPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === 'EPERM'
  }
}

export function createClaudeProvider(deps: ClaudeProviderDeps = {}): Provider {
  const claudeDir = deps.claudeDir ?? join(homedir(), '.claude')
  const isPidAlive = deps.isPidAlive ?? defaultIsPidAlive

  return {
    id: 'claude',
    // What Claude Code can do; the surfaces land in later issues, but the
    // capability contract is stable now (ADR-0003).
    capabilities: { canControl: true, hasRateLimits: true, hasSubagents: true },
    async listSessions() {
      return discoverSessions({ claudeDir, isPidAlive })
    },
  }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm test`
Expected: PASS — all four test files green.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm typecheck`
Expected: no output, exit 0.

```bash
git add src/main/provider/types.ts src/main/provider/claude/index.ts tests/provider/provider.test.ts
git commit -m "feat: ClaudeProvider facade with capability flags"
```

---

## Task 7: SQLite index

The minimal index: write the current snapshot of running sessions, read it back. better-sqlite3 runs in Electron's main process (rebuilt ABI), so this is **not** unit-tested here — it's exercised when the app launches in Task 9. Real incremental sync and aggregate tests are issue #4.

**Files:**
- Create: `src/main/db/index.ts`

- [ ] **Step 1: Write `src/main/db/index.ts`**

The table stores only the columns the skeleton row needs. `getSessions` re-materializes the deferred normalized fields (usage, cost, context, tasks, subagents) with the same defaults the Provider used, so the renderer always receives a complete `Session`.

```typescript
import Database from 'better-sqlite3'
import type { Session } from '@shared/types'
import { contextWindowFor, normalizeModelId } from '@shared/models'

export type AppDb = Database.Database

export function openDb(path: string): AppDb {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      project TEXT NOT NULL,
      branch TEXT,
      state TEXT NOT NULL,
      management TEXT NOT NULL,
      model TEXT NOT NULL,
      last_activity_ms INTEGER NOT NULL
    )
  `)
  return db
}

/** Full-replace the running-session snapshot. Incremental sync is issue #4. */
export function replaceSessions(db: AppDb, sessions: Session[]): void {
  const insert = db.prepare(`
    INSERT INTO sessions (id, title, project, branch, state, management, model, last_activity_ms)
    VALUES (@id, @title, @project, @branch, @state, @management, @model, @last_activity_ms)
  `)

  const tx = db.transaction((rows: Session[]) => {
    db.prepare('DELETE FROM sessions').run()
    for (const s of rows) {
      insert.run({
        id: s.id,
        title: s.title,
        project: s.project,
        branch: s.branch ?? null,
        state: s.state,
        management: s.management,
        model: s.model,
        last_activity_ms: s.lastActivityMs,
      })
    }
  })

  tx(sessions)
}

interface Row {
  id: string
  title: string
  project: string
  branch: string | null
  state: string
  management: string
  model: string
  last_activity_ms: number
}

export function getSessions(db: AppDb): Session[] {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY last_activity_ms DESC').all() as Row[]

  return rows.map((r) => {
    const model = normalizeModelId(r.model)
    return {
      id: r.id,
      title: r.title,
      project: r.project,
      branch: r.branch ?? undefined,
      state: r.state as Session['state'],
      management: r.management as Session['management'],
      model,
      contextPct: 0,
      contextWindow: contextWindowFor(model),
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
      equivApiValueUsd: 0,
      lastActivityMs: r.last_activity_ms,
      tasks: [],
      subagents: [],
    }
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no output, exit 0. (The native binary isn't loaded by typecheck — only the types from `@types/better-sqlite3` are.)

- [ ] **Step 3: Commit**

```bash
git add src/main/db/index.ts
git commit -m "feat: minimal SQLite index for the running-session snapshot"
```

---

## Task 8: IPC wiring and the preload bridge

Connect the dots in the main process: open the DB, build the Provider, register IPC handlers, and run one sync on launch (parse → SQLite). The render path reads from SQLite; parsing happens only on launch and on explicit refresh — satisfying "rows served from SQLite, not parsed live on every render."

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Create: `src/renderer/src/api.d.ts`

- [ ] **Step 1: Write `src/main/ipc.ts`**

```typescript
import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { Provider } from './provider/types'
import { getSessions, replaceSessions, type AppDb } from './db'

export interface IpcDeps {
  db: AppDb
  provider: Provider
}

export function registerIpc({ db, provider }: IpcDeps): { sync: () => Promise<void> } {
  const sync = async (): Promise<void> => {
    const sessions = await provider.listSessions()
    replaceSessions(db, sessions)
  }

  ipcMain.handle(IPC.listSessions, () => getSessions(db))
  ipcMain.handle(IPC.refresh, async () => {
    await sync()
    return getSessions(db)
  })
  ipcMain.handle(IPC.capabilities, () => provider.capabilities)

  return { sync }
}
```

- [ ] **Step 2: Replace `src/main/index.ts` with the wired version**

```typescript
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { openDb } from './db'
import { createClaudeProvider } from './provider/claude'
import { registerIpc } from './ipc'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    backgroundColor: '#141413',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  const db = openDb(join(app.getPath('userData'), 'index.db'))
  const provider = createClaudeProvider()
  const { sync } = registerIpc({ db, provider })

  await sync() // parse ~/.claude → SQLite once, before the window asks for rows

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 3: Replace `src/preload/index.ts` with the real bridge**

Typing the object as `IpcApi` guarantees the bridge matches the contract.

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type IpcApi } from '@shared/ipc'

const api: IpcApi = {
  listSessions: () => ipcRenderer.invoke(IPC.listSessions),
  refresh: () => ipcRenderer.invoke(IPC.refresh),
  capabilities: () => ipcRenderer.invoke(IPC.capabilities),
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 4: Write `src/renderer/src/api.d.ts`**

Makes `window.api` typed in the renderer.

```typescript
import type { IpcApi } from '@shared/ipc'

declare global {
  interface Window {
    api: IpcApi
  }
}

export {}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc.ts src/main/index.ts src/preload/index.ts src/renderer/src/api.d.ts
git commit -m "feat: wire provider → SQLite → typed IPC on launch"
```

---

## Task 9: The bare Overview

Render one row per running Session from SQLite over IPC, plus a capability footer (proving the flags flow through as normalized data) and a Refresh button (proving the read path re-queries SQLite). "No styling beyond legible" — a plain dark table using the existing CSS tokens. This is the end-to-end acceptance check.

**Files:**
- Create: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/main.tsx`

- [ ] **Step 1: Write `src/renderer/src/App.tsx`**

```tsx
import { useEffect, useState, type CSSProperties } from 'react'
import type { Session, ProviderCapabilities } from '@shared/types'

const STATE_LABEL: Record<Session['state'], string> = {
  working: 'Working',
  waiting: 'Waiting',
  idle: 'Idle',
  ended: 'Ended',
}

const cell: CSSProperties = { padding: '6px 8px' }
const muted: CSSProperties = { ...cell, color: 'var(--color-fg-muted)' }

export function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [caps, setCaps] = useState<ProviderCapabilities | null>(null)
  const [loading, setLoading] = useState(true)

  async function load(): Promise<void> {
    setLoading(true)
    const [s, c] = await Promise.all([window.api.listSessions(), window.api.capabilities()])
    setSessions(s)
    setCaps(c)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function refresh(): Promise<void> {
    setLoading(true)
    setSessions(await window.api.refresh())
    setLoading(false)
  }

  return (
    <div className="app-bg" style={{ minHeight: '100vh', padding: 24, color: 'var(--color-fg)' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>code-by-wire</h1>
        <span style={{ color: 'var(--color-fg-muted)', fontSize: 13 }}>
          {sessions.length} running session{sessions.length === 1 ? '' : 's'}
        </span>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          style={{
            marginLeft: 'auto',
            background: 'var(--color-ink-800)',
            color: 'var(--color-fg)',
            border: '1px solid var(--color-ink-700)',
            borderRadius: 6,
            padding: '4px 12px',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Syncing…' : 'Refresh'}
        </button>
      </header>

      {sessions.length === 0 && !loading ? (
        <p style={{ color: 'var(--color-fg-muted)' }}>No running Claude Code sessions found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr
              style={{
                textAlign: 'left',
                color: 'var(--color-fg-muted)',
                borderBottom: '1px solid var(--color-ink-700)',
              }}
            >
              <th style={cell}>State</th>
              <th style={cell}>Title</th>
              <th style={cell}>Project</th>
              <th style={cell}>Branch</th>
              <th style={cell}>Model</th>
              <th style={cell}>Mgmt</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--color-ink-850)' }}>
                <td style={cell}>{STATE_LABEL[s.state]}</td>
                <td style={cell}>{s.title}</td>
                <td style={muted}>{s.project}</td>
                <td style={muted}>{s.branch ?? '—'}</td>
                <td style={cell}>{s.model}</td>
                <td style={muted}>{s.management}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {caps && (
        <footer style={{ marginTop: 24, color: 'var(--color-fg-faint)', fontSize: 12 }}>
          ClaudeProvider · control {caps.canControl ? '✓' : '✗'} · limits{' '}
          {caps.hasRateLimits ? '✓' : '✗'} · subagents {caps.hasSubagents ? '✓' : '✗'}
        </footer>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `src/renderer/src/main.tsx` to mount `<App/>`**

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no output, exit 0.

- [ ] **Step 4: Launch and verify the full spine**

First make sure at least one Claude Code session is running (e.g. open a `claude` session in another terminal), so there's a row to see.

Run: `pnpm dev`
Expected: the window opens and shows a table with **one row per currently-running Claude Code session** — each with State, Title (its first prompt or project name), Project, Branch, Model, and `observed`. The footer reads `ClaudeProvider · control ✓ · limits ✓ · subagents ✓`. Start or stop a `claude` session elsewhere, click **Refresh**, and the row set updates.

If the window errors with `NODE_MODULE_VERSION` / `was compiled against a different Node.js version`, better-sqlite3 needs rebuilding for the current Electron: stop the app, run `pnpm rebuild:native`, and `pnpm dev` again.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/main.tsx
git commit -m "feat: bare Overview rendering live sessions from SQLite over IPC"
```

---

## Task 10: Production build check and docs

Confirm a real production build works across all three processes, and update the README so the next agent runs the app the new way. The prototype stays put and is documented as dormant.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Verify the production build**

Run: `pnpm build`
Expected: builds `out/main`, `out/preload`, and `out/renderer` with no errors (`✓ built in …` for each). This catches anything that works in dev but breaks bundled.

- [ ] **Step 2: Run the full test suite once more**

Run: `pnpm test`
Expected: 4 test files, all green.

- [ ] **Step 3: Update the README "Develop" section**

Replace the `## Develop` section (the `pnpm dev` prototype instructions) with:

```markdown
## Develop

```
pnpm install
pnpm rebuild:native   # rebuild better-sqlite3 for Electron's ABI (re-run after an Electron upgrade)
pnpm dev              # launches the Electron app
```

`pnpm dev` opens the app and shows one row per running Claude Code session, served from an
embedded SQLite index. `pnpm test` runs the ClaudeProvider read tests over the redacted
`~/.claude` fixtures in `tests/fixtures/`. `pnpm typecheck` checks the main and renderer projects.

The code under `src/prototype/` is throwaway and browser-only — now dormant (nothing imports it).
Issue #10 folds Overview variant B into the real Overview and deletes the rest.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update Develop instructions for the Electron app"
```

- [ ] **Step 5: (Optional) Open the PR referencing issue #2**

When ready to publish (remember the host pin from `docs/agents/issue-tracker.md`):

```bash
GH_HOST=github.com gh pr create -R luojiahai/code-by-wire-source \
  --title "Walking skeleton: Electron shell + one live Session as a row" \
  --body "Closes #2"
```

---

## Acceptance Criteria Check (issue #2)

- **One row per currently-running Session** → Task 9 launch shows it; discovery filters by live pid (Task 5).
- **Rows served from SQLite, not parsed live per render** → parse runs only in `sync()` on launch/refresh, writing SQLite (Task 8); the renderer reads via `getSessions` (Tasks 7, 9).
- **Capability flags exposed; renderer consumes only normalized types** → `ProviderCapabilities` over IPC, rendered in the footer; the renderer imports only `@shared/*` (Tasks 6, 8, 9).
- **Provider read covered by tests over redacted `~/.claude` fixtures** → `transcript.test.ts`, `discover.test.ts`, `provider.test.ts`, `models.test.ts` over `tests/fixtures/claude-home/` (Tasks 3–6).
