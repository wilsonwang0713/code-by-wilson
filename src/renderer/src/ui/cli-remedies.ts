import type { CliStatusKind, InstallMethod } from "@shared/cli-status";

export interface InstallTab {
  method: Exclude<InstallMethod, "unknown">;
  label: string;
  command: string;
  note?: string;
}

/** The install commands, current as of the Claude Code docs (setup guide). */
export const INSTALL_TABS: InstallTab[] = [
  {
    method: "native",
    label: "Native installer",
    command: "curl -fsSL https://claude.ai/install.sh | bash",
    note: "Installs to ~/.local/bin/claude — make sure ~/.local/bin is on your PATH.",
  },
  {
    method: "homebrew",
    label: "Homebrew",
    command: "brew install --cask claude-code",
  },
  {
    method: "npm",
    label: "npm",
    command: "npm install -g @anthropic-ai/claude-code",
  },
];

const UPGRADE: Record<InstallMethod, string> = {
  native: "claude update",
  homebrew: "brew upgrade claude-code",
  npm: "npm install -g @anthropic-ai/claude-code@latest",
  unknown: "claude update",
};

export type RemedySection = "install" | "update" | "login" | "verify";

export interface Remedy {
  section: RemedySection;
  /** The single most relevant command, when there is one. */
  command?: string;
  /** For install: which tab to open first. */
  defaultTab?: InstallTab["method"];
}

export function remediesFor(input: {
  kind: CliStatusKind;
  installMethod: InstallMethod;
}): Remedy {
  switch (input.kind) {
    case "notFound":
      return {
        section: "install",
        defaultTab:
          input.installMethod === "unknown" ? "native" : input.installMethod,
      };
    case "outdated":
      return { section: "update", command: UPGRADE[input.installMethod] };
    case "loggedOut":
      return { section: "login" };
    case "unknown":
    case "ready":
    default:
      return { section: "verify", command: "claude --version" };
  }
}
