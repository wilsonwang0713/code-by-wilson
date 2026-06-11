# Releasing

The app ships as an unsigned macOS `.dmg` for Apple Silicon (`arm64`), attached
to a GitHub release. The build runs in CI on a macOS runner; you never build a
release on your own machine.

The whole flow is driven by pushing a `vX.Y.Z` tag. CI builds the dmg and uploads
it to a **draft** GitHub release. You review the draft, then publish it.

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
     Cheap guard before the mac runner spins up.
   - `release` on `macos-14`: install → `rebuild:native` → `build` →
     `electron-builder --publish never`, then a `gh` step creates the draft
     release once and uploads the dmg, its blockmap, and `latest-mac.yml`.

5. **Publish the draft.** Releases → find the draft → confirm the notes match the
   changelog → **Publish release**.

## Why CI uploads the assets by hand

Don't "simplify" the release job back to `electron-builder --publish always`. Its
GitHub publisher uploads files in parallel, and a draft release can't be looked
up by tag, so each upload races to create its own draft. v0.1.0's first run
produced **two** draft releases with the dmg, blockmap, and `latest-mac.yml`
scattered across them, and the job still went green looking like a clean release.

So the job builds with `--publish never` and uploads through `gh` instead: it
creates the draft once (or reuses it on a re-run) and uploads with `--clobber`,
which is deterministic and idempotent.

## Apple Silicon only

Releases are `arm64` only. The Intel (`x64`) leg was dropped: GitHub's `macos-13`
runners queue for 10-30+ min and are on the way out, and the user base is Apple
Silicon. Bringing x64 back means adding a second runner leg and reconciling the
two `latest-mac.yml` manifests into one.

## Verify a published release

```
GH_HOST=github.com gh release view vX.Y.Z -R luojiahai/code-by-wire
```

Expect `code-by-wire-X.Y.Z-arm64.dmg` (+ `.blockmap`) and `latest-mac.yml`. An
empty asset list means the upload step didn't run or failed. Read the release
job log.

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

If a release ends up wrong (empty, or assets split across duplicate drafts from
an old `--publish always` run):

1. The dmg may already be on GitHub, just attached to the wrong/duplicate draft.
   Download each asset by id:
   `GH_HOST=github.com gh api repos/luojiahai/code-by-wire/releases/assets/<id> -H "Accept: application/octet-stream" > <name>`.
2. Delete the bad release(s), keeping the git tag:
   `GH_HOST=github.com gh api -X DELETE repos/luojiahai/code-by-wire/releases/<release_id>`.
3. Assemble one clean release from the downloaded files:
   `GH_HOST=github.com gh release create vX.Y.Z -R luojiahai/code-by-wire --latest --title "code-by-wire vX.Y.Z" --notes "..." <files>`.

   Or, to rebuild from scratch, re-push the tag
   (`git push origin :refs/tags/vX.Y.Z && git push origin vX.Y.Z`) and let CI
   produce a fresh draft.

## Code signing

Releases are unsigned (`identity: null` in `electron-builder.yml`). On first
launch users get Gatekeeper's "unidentified developer" warning; they
right-click → Open, or run `xattr -dr com.apple.quarantine <App>.app`. Signing
and notarization aren't set up yet.
