import type { CliStatus } from "@shared/cli-status";
import { footerView, type FooterView } from "./rail-footer";

// Dot hue by state, drawn from the reserved status palette (index.css @theme): teal `working` for ok,
// amber `accent` for warn, red `danger` for error, slate `ink-600` for the pre-check idle.
const DOT_CLASS: Record<FooterView["dot"], string> = {
  ok: "bg-working",
  warn: "bg-accent",
  error: "bg-danger",
  idle: "bg-ink-600",
};

/** A thin strip pinned at the bottom of the rail carrying the live Claude Code CLI status: a state dot,
 *  the label, version + path, a Re-check action, and a Troubleshoot button whenever the CLI isn't ready. */
export function RailFooter({
  status,
  onRecheck,
  onTroubleshoot,
}: {
  status: CliStatus | null;
  onRecheck: () => void;
  onTroubleshoot: () => void;
}) {
  const v = footerView(status);
  return (
    <div className="flex shrink-0 flex-col gap-1 border-t border-ink-800 px-3 py-2 font-mono text-[10px] text-fg-faint">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[v.dot]}`} />
        <span className="text-fg-muted">Claude Code</span>
        <span className="ml-auto uppercase tracking-wide">{v.statusLabel}</span>
      </div>
      {(v.version || v.path) && (
        <div className="truncate text-fg-faint">
          {v.version ? `v${v.version}` : "—"}
          {v.path ? ` · ${v.path}` : ""}
        </div>
      )}
      <div className="flex items-center gap-2">
        {v.showTroubleshoot && (
          <button
            onClick={onTroubleshoot}
            className="text-accent-bright hover:underline"
          >
            Troubleshoot
          </button>
        )}
        <button onClick={onRecheck} className="ml-auto hover:text-fg-muted">
          ↻ Re-check
        </button>
      </div>
    </div>
  );
}
