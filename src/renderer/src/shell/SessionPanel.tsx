import type { ReactNode } from "react";
import type { Session } from "@shared/types";
import type { GitInfo, PrInfo } from "@shared/metrics";
import { formatClock } from "@shared/format";
import { modelLabel } from "../ui/meta";
import { PanelSection, PanelHeading } from "../workspace/panels/chrome";
import { GitReadout } from "./GitReadout";

/**
 * The cockpit's identity footer (cockpit spec §Session): Model (with effort folded in), Git (the
 * readout, now carrying PR review state), Lines (the session's ± footprint from the capture), and
 * Clock — each an always-shown label/value row; `-` fills a row whose data hasn't landed.
 */
export function SessionPanel({
  session: s,
  git,
  pr,
}: {
  session: Session;
  git?: GitInfo | null;
  pr?: PrInfo | null;
}) {
  const model = modelLabel(
    s.model,
    s.modelId ?? s.modelRaw,
    s.modelDisplayName,
    { known: s.management === "managed" },
  );
  const modelValue = s.effortLevel ? `${model} · ${s.effortLevel}` : model;
  const clock = s.sessionClockMs != null ? formatClock(s.sessionClockMs) : null;
  const hasLines = s.linesAdded != null || s.linesRemoved != null;
  return (
    <PanelSection>
      <PanelHeading>Session</PanelHeading>
      <SessionRow label="Model">
        <span className="min-w-0 truncate" title={modelValue}>
          {modelValue}
        </span>
      </SessionRow>
      <SessionRow label="Git">
        <GitReadout session={s} git={git} pr={pr} />
      </SessionRow>
      <SessionRow label="Lines">
        {hasLines ? (
          <>
            <span className="text-(--ui-green)">+{s.linesAdded ?? 0}</span>
            <span className="text-(--ui-red)">−{s.linesRemoved ?? 0}</span>
          </>
        ) : (
          "-"
        )}
      </SessionRow>
      <SessionRow label="Clock">{clock ?? "-"}</SessionRow>
    </PanelSection>
  );
}

/** One session row: a plain-case label on the left, a mono value cluster on the right.
 *  Plain case — uppercase is reserved for section headers. */
function SessionRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[1.375rem] items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-(--ui-text-tertiary)">
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-(--ui-text-secondary)">
        {children}
      </span>
    </div>
  );
}
