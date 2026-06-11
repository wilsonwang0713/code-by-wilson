# Releasing

The app ships as an unsigned macOS `.dmg`, one per architecture (Apple Silicon
`arm64` and Intel `x64`), attached to a GitHub release. Builds run in CI on real
macOS runners; you never build a release on your own machine.

The flow is driven entirely by pushing a `vX.Y.Z` tag. `electron-builder` does
the rest: it builds each dmg and uploads it to a **draft** GitHub release that it
creates for the tag. You review the draft, then publish it.

## The one rule that matters

**Never create the GitHub release yourself.** No `gh release create`, no
"Draft a new release" in the web UI before CI runs.

`electron-builder` publishes into a *draft* release. If a *published* release
already exists for the tag, it refuses every upload with:

```
GitHub release not created  reason=existing type not compatible with publishing type
  existingType=release publishingType=draft
skipped publishing  file=code-by-wire-X.Y.Z-arm64.dmg  reason=...
```

The build step still exits 0, so the job goes **green with zero assets
attached**. The release looks done and ships nothing. Push the tag and let CI
own release creation.

## Cut a release

1. **Pick the version.** Semantic Versioning. `package.json` `version` is the
   source of truth; the tag is `v` + that exact string.

2. **Bump and changelog, on `main`.**
   - Set `version` in `package.json`.
   - In `CHANGELOG.md`, move the `[Unreleased]` entries into a new
     `## [X.Y.Z] - YYYY-MM-DD` section and fix the compare links at the bottom.
   - Commit (`build(release): vX.Y.Z`), open a PR, merge it.

3. **Tag the release commit and push the tag** (and only the tag):

   ```
   git switch main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

   The push triggers `.github/workflows/release.yml`.

4. **Wait for CI.** The run does:
   - `verify`: fails fast if the tag doesn't equal `v` + `package.json` version.
     Cheap guard before any mac runner spins up.
   - `release` matrix, **one arch at a time** (`max-parallel: 1`): `macos-14`
     builds `arm64`, `macos-13` builds `x64`. Each runs install →
     `rebuild:native` → `build` → `electron-builder --publish always`. The first
     leg creates the draft release; both attach their dmg + blockmap, and
     `latest-mac.yml` lands for auto-update.

   Intel (`macos-13`, `x64`) runners are scarce and being retired by GitHub, so
   that leg can sit **queued for 10-30+ min** before it even starts. That's
   normal, not a hang. Check the job status: `queued` with no runner means it's
   waiting in line; `in_progress` means it's actually building.

5. **Publish the draft.** Once both legs are green: Releases → find the draft →
   confirm the notes match the changelog → **Publish release**.

## Verify a published release

Both dmgs and the auto-update manifest should be attached:

```
GH_HOST=github.com gh release view vX.Y.Z -R luojiahai/code-by-wire
```

Expect `code-by-wire-X.Y.Z-arm64.dmg` (+ `.blockmap`),
`code-by-wire-X.Y.Z.dmg` (+ `.blockmap`), and `latest-mac.yml`. An empty asset
list means an upload was skipped (see the rule above) — read the
`electron-builder` step log for the reason.

## Build a dmg locally (testing only, no publish)

For a throwaway dmg to smoke-test packaging, never for a release:

```
pnpm rebuild:native   # rebuild better-sqlite3 + node-pty for Electron's ABI first
pnpm dist             # electron-vite build && electron-builder --mac --publish never
```

The dmg lands in `release/`. It's your current arch only and unsigned. `pnpm
dist` does **not** run `rebuild:native` for you; skip it and the app crashes on
launch with a native-module ABI mismatch.

## Recovering a botched release

If a release published with no assets (the trap above), don't fight it in place:

1. Delete the empty release, keeping the tag:
   `GH_HOST=github.com gh release delete vX.Y.Z -R luojiahai/code-by-wire`
   (leave the git tag alone).
2. Re-trigger CI by re-pushing the tag:
   `git push origin :refs/tags/vX.Y.Z && git push origin vX.Y.Z`.
3. With no release present, `electron-builder` creates a fresh draft and uploads
   into it. Publish that draft.

## Code signing

Releases are unsigned (`identity: null` in `electron-builder.yml`). On first
launch users get Gatekeeper's "unidentified developer" warning; they
right-click → Open, or run `xattr -dr com.apple.quarantine <App>.app`. Signing
and notarization aren't set up yet.
