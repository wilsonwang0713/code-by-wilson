import { useState, type ReactNode } from "react";
import type { CliStatus } from "@shared/cli-status";
import { remediesFor, INSTALL_TABS } from "./cli-remedies";
import { cliStatusView, type CliStatusView } from "./cli-status-view";

// Banner styling by tone. The dot + headline color and the tinted frame all key off the same tone,
// so the banner reads as one coherent status chip. ok → teal, warn → amber, error → red.
const BANNER: Record<
  CliStatusView["tone"],
  { frame: string; head: string; dot: string }
> = {
  ok: {
    frame: "border-working/40 bg-working/5",
    head: "text-working-bright",
    dot: "bg-working",
  },
  warn: {
    frame: "border-accent/40 bg-accent/5",
    head: "text-accent-bright",
    dot: "bg-accent",
  },
  error: {
    frame: "border-danger/40 bg-danger/5",
    head: "text-danger",
    dot: "bg-danger",
  },
};

/**
 * The single home for Claude Code CLI status and config, opened from the rail panel's info button in any
 * state. The layout is invariant across states: a status banner, a version/path/config readout, the binary
 * override, and the footer actions. Only the banner is dynamic — its tone, headline, detail, and (when not
 * ready) the remedy commands change with the CLI's state; the rest never reshapes.
 */
export function CliStatusModal({
  status,
  checking,
  onClose,
  onRecheck,
  onSetBinPath,
}: {
  status: CliStatus;
  /** A check is in flight (Re-check or Save) — spin the Re-check glyph and disable both actions. */
  checking: boolean;
  onClose: () => void;
  onRecheck: () => void;
  onSetBinPath: (path: string | null) => void;
}) {
  const view = cliStatusView(status);
  const remedy = remediesFor({
    kind: status.kind,
    installMethod: status.installMethod,
  });
  const banner = BANNER[view.tone];
  const [tab, setTab] = useState(remedy.defaultTab ?? "native");
  const activeInstall = INSTALL_TABS.find((t) => t.method === tab);
  const [binPath, setBinPath] = useState(
    status.source === "override" ? (status.path ?? "") : "",
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[460px] max-w-[90vw] rounded-xl border border-ink-700 bg-ink-900 font-mono text-xs text-fg-muted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-ink-800 px-4 py-3">
          <span className="text-sm font-semibold text-fg">Claude Code CLI</span>
        </div>

        <div className="space-y-3 px-4 py-3">
          {/* The one dynamic region: tone, headline, advice, and any remedy commands. */}
          <div className={`rounded-lg border px-3 py-2.5 ${banner.frame}`}>
            <div
              className={`flex items-center gap-2 text-[13px] font-semibold ${banner.head}`}
            >
              <span className={`h-2 w-2 rounded-full ${banner.dot}`} />
              {view.headline}
              {status.version && (
                <span className="font-mono text-[11px] font-normal text-fg-muted">
                  v{status.version}
                </span>
              )}
            </div>
            <div className="mt-1 text-fg-muted">{view.detail}</div>
            {status.kind !== "ready" && (
              <div className="mt-2.5 space-y-2">
                {remedy.section === "install" && (
                  <div>
                    <div className="mb-2 flex gap-1.5">
                      {INSTALL_TABS.map((t) => (
                        <button
                          key={t.method}
                          onClick={() => setTab(t.method)}
                          className={
                            tab === t.method
                              ? "rounded bg-ink-700 px-2 py-1 text-fg"
                              : "px-2 py-1"
                          }
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {activeInstall && (
                      <CommandRow
                        cmd={activeInstall.command}
                        note={activeInstall.note}
                      />
                    )}
                  </div>
                )}
                {remedy.section === "update" && remedy.command && (
                  <CommandRow cmd={remedy.command} />
                )}
                {remedy.section === "login" && (
                  <div className="text-fg-faint">
                    Start a session (the terminal prompts you to log in), or run{" "}
                    <code>claude</code> in your shell.
                  </div>
                )}
                {remedy.section === "verify" && (
                  <div className="space-y-2">
                    <div className="text-fg-faint">
                      Run <code>claude --version</code> in a terminal to check
                      it works.
                    </div>
                    {status.path && (
                      <CommandRow
                        cmd={`xattr -d com.apple.quarantine ${status.path}`}
                        note="If macOS blocked the binary."
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Invariant readout. */}
          <div className="space-y-1.5">
            <Row label="Version">
              {status.version ? `v${status.version}` : "not detected"}
            </Row>
            <Row label="Path">
              {status.path ?? "No binary resolved."}
              {status.duplicates.length > 1 && (
                <div className="mt-1 text-accent-bright">
                  Multiple claude installs found; the app uses the first above.
                </div>
              )}
            </Row>
            <Row label="Config dir">
              {status.configDir.active}
              {status.configDir.mismatch && (
                <div className="mt-1 text-accent-bright">
                  The CLI uses {status.configDir.recovered}; restart after
                  fixing.
                </div>
              )}
            </Row>
          </div>

          {/* Invariant: set a custom claude binary, available in every state. */}
          <div className="border-t border-ink-800 pt-3">
            <div className="mb-1 text-fg-faint">
              Binary path override (works for app launches):
            </div>
            <div className="flex gap-2">
              <input
                value={binPath}
                onChange={(e) => setBinPath(e.target.value)}
                placeholder="/absolute/path/to/claude"
                className="flex-1 rounded border border-ink-700 bg-ink-950 px-2 py-1 text-fg"
              />
              <button
                onClick={() => onSetBinPath(binPath.trim() || null)}
                disabled={checking}
                className="rounded border border-ink-700 px-2 py-1 disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-ink-800 px-4 py-3">
          <a
            href="https://code.claude.com/docs/en/setup"
            target="_blank"
            rel="noreferrer"
            className="text-accent-bright"
          >
            ↗ Install docs
          </a>
          <button
            onClick={onRecheck}
            disabled={checking}
            className="ml-auto rounded border border-ink-700 px-2 py-1 disabled:opacity-60"
          >
            <span className={checking ? "inline-block animate-spin" : ""}>
              ↻
            </span>{" "}
            {checking ? "Checking…" : "Re-check"}
          </button>
          <button
            onClick={onClose}
            className="rounded border border-ink-700 px-2 py-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** A labelled readout row in the invariant body: a fixed-width faint label and its value. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-fg-faint">{label}</span>
      <span className="min-w-0 flex-1 break-all text-fg">{children}</span>
    </div>
  );
}

function CommandRow({ cmd, note }: { cmd: string; note?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 rounded border border-ink-800 bg-ink-950 px-2 py-1.5">
        <code className="flex-1 overflow-x-auto text-working">{cmd}</code>
        <button
          onClick={() => void navigator.clipboard.writeText(cmd)}
          className="text-fg-faint"
        >
          copy
        </button>
      </div>
      {note && <div className="mt-1 text-[10px] text-fg-faint">{note}</div>}
    </div>
  );
}
