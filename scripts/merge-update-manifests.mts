// Merges electron-builder's per-arch auto-update manifests (latest-mac.yml,
// latest.yml) into one manifest per platform whose `files:` array lists every
// architecture. electron-updater matches the running machine's arch against
// that array, so a manifest listing only one arch silently hands the wrong
// installer to half the users.
//
// Each arch is built on its own native runner (.github/workflows/release.yml),
// so each leg emits a single-arch manifest. The `merge` job runs this after the
// build matrix to combine them before upload.
//
// Pure logic is `mergeManifests` (unit-tested). The CLI wrapper at the bottom
// only does file I/O. Runs under Node 24 native type stripping:
//   node scripts/merge-update-manifests.mts --primary-arch arm64 --out latest-mac.yml a.yml b.yml

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

export interface UpdateFile {
  url: string;
  sha512: string;
  size: number;
  [key: string]: unknown;
}

export interface UpdateManifest {
  version: string;
  files: UpdateFile[];
  path: string;
  sha512: string;
  releaseDate: string;
  [key: string]: unknown;
}

/**
 * Merge per-arch manifests into one. All inputs must share a version (same
 * release). `primaryArch` chooses which file fills the legacy top-level
 * `path`/`sha512`; if no file matches, the first file wins.
 */
export function mergeManifests(
  manifests: UpdateManifest[],
  options: { primaryArch: string },
): UpdateManifest {
  if (manifests.length === 0) {
    throw new Error("mergeManifests: no manifests provided");
  }

  const versions = new Set(manifests.map((m) => m.version));
  if (versions.size > 1) {
    throw new Error(
      `mergeManifests: version mismatch across manifests: ${[...versions].join(", ")}`,
    );
  }

  const files = manifests.flatMap((m) => m.files);
  const primary =
    files.find((f) => f.url.includes(options.primaryArch)) ?? files[0];
  const releaseDate = manifests
    .map((m) => m.releaseDate)
    .sort()
    .at(-1)!;

  return {
    ...manifests[0],
    files,
    path: primary.url,
    sha512: primary.sha512,
    releaseDate,
  };
}

function parseArgs(argv: string[]): {
  primaryArch: string;
  out: string;
  inputs: string[];
} {
  let primaryArch = "";
  let out = "";
  const inputs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--primary-arch") {
      primaryArch = argv[++i];
    } else if (arg === "--out") {
      out = argv[++i];
    } else {
      inputs.push(arg);
    }
  }
  if (!primaryArch || !out || inputs.length === 0) {
    throw new Error(
      "usage: merge-update-manifests --primary-arch <arch> --out <file> <manifest.yml...>",
    );
  }
  return { primaryArch, out, inputs };
}

// Run the CLI only when invoked directly, never when imported by the test.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { primaryArch, out, inputs } = parseArgs(process.argv.slice(2));
  const manifests = inputs.map(
    (p) => yaml.load(readFileSync(p, "utf8")) as UpdateManifest,
  );
  const merged = mergeManifests(manifests, { primaryArch });
  // lineWidth -1 keeps long sha512 values on one line (no YAML folding).
  writeFileSync(out, yaml.dump(merged, { lineWidth: -1 }));
  console.log(`merged ${inputs.length} manifest(s) -> ${out}`);
}
