import { type ReactNode } from "react";
import type { Session } from "@shared/types";
import type { GitInfo } from "@shared/metrics";
import { formatClock } from "@shared/format";
import { cx } from "../ui/atoms";
import { modelLabel, STATE_META } from "../ui/meta";
import { MODE_INFO } from "./mode-info";

/**
 * The workspace header's instrument strip — the cockpit's annunciator. Two status lamps (State, Link)
 * carry live LEDs, then a seam, then the identity readouts (Model · Effort, Repo, Clock). Context and
 * spend deliberately stay out: they live in the telemetry sidebar, and the bar must not echo a gauge
 * sitting right beside it. Color appears only on the lamps, where it encodes state.
 */
export function Annunciator({
  session: s,
  git,
}: {
  session: Session;
  git?: GitInfo | null;
}) {
  const state = STATE_META[s.state];
  const pulses = s.state === "working" || s.state === "waiting";
  const managed = s.management === "managed";
  const mode = MODE_INFO[s.management];
  const model = modelLabel(
    s.model,
    s.modelId ?? s.modelRaw,
    s.modelDisplayName,
    { compact: true, known: managed },
  );
  const branch = git?.branch ?? s.branch ?? "—";
  const gitTitle = git
    ? `${git.branch} · +${git.insertions} −${git.deletions} · ${git.dirty ? "dirty" : "clean"}`
    : s.branch
      ? `${s.project} · ${s.branch}`
      : s.project;
  const clock = s.sessionClockMs != null ? formatClock(s.sessionClockMs) : null;
  return (
    <div className="mt-2 flex items-stretch overflow-hidden rounded-md border border-ink-800 bg-well shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
      <Cell
        label="State"
        led={state.dot}
        ledPulse={pulses}
        valueClass={state.text}
      >
        {state.label}
      </Cell>
      <Cell
        label="Link"
        led={managed ? "bg-primary" : "bg-idle"}
        valueClass={managed ? "text-primary" : "text-fg-muted"}
        title={mode.blurb}
      >
        {mode.label}
      </Cell>
      <Cell label="Model · Effort" grow={1.5} seam>
        {model}
        {s.effortLevel && <span className="text-fg"> · {s.effortLevel}</span>}
      </Cell>
      <Cell label="Git" grow={2.4} truncate title={gitTitle}>
        <span className="text-fg">{branch}</span>
        {git && (git.insertions || git.deletions) ? (
          <>
            {" "}
            <span className="text-ok">+{git.insertions}</span>{" "}
            <span className="text-danger">−{git.deletions}</span>
          </>
        ) : null}
        {git?.ahead ? (
          <span className="text-fg-muted"> ↑{git.ahead}</span>
        ) : null}
      </Cell>
      <Cell label="Clock">{clock ?? "—"}</Cell>
    </div>
  );
}

/** One annunciator cell: a Saira placard label over a mono readout. `led` adds a status lamp before the
 *  value (pulsing for live states); `seam` draws the divider between the status lamps and the readouts. */
function Cell({
  label,
  led,
  ledPulse,
  valueClass,
  grow,
  seam,
  truncate,
  title,
  children,
}: {
  label: string;
  led?: string;
  ledPulse?: boolean;
  valueClass?: string;
  grow?: number;
  seam?: boolean;
  truncate?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      title={title}
      style={{ flex: grow ?? 1 }}
      className={cx(
        "flex min-w-0 flex-col gap-[3px] border-r border-ink-850 px-3 py-1.5 last:border-r-0",
        seam && "border-l border-ink-800",
      )}
    >
      <span className="font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
        {label}
      </span>
      <span
        className={cx(
          "flex min-w-0 items-center gap-1.5 font-mono text-[12px]",
          valueClass ?? "text-fg",
        )}
      >
        {led && (
          <span
            className={cx(
              "h-[7px] w-[7px] shrink-0 rounded-full",
              led,
              ledPulse && "animate-pulse-soft",
            )}
          />
        )}
        <span className={cx("min-w-0", truncate && "truncate")}>
          {children}
        </span>
      </span>
    </div>
  );
}
