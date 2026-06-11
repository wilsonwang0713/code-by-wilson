import type { ReactNode } from 'react'
import { Icon } from '../../ui/icons'

// Shared chrome for the workspace rail panels, so a retone lands in one place.

/** A rail panel's shell: vertical rhythm, a bottom hairline, and bottom padding. */
export function PanelSection({ children }: { children: ReactNode }) {
  return <section className="space-y-2 border-b border-ink-800 pb-3.5 last:border-0">{children}</section>
}

/**
 * A panel's small uppercase eyebrow heading. With no `info`/`right` it is the bare h2 (unchanged for the
 * Git/Tasks/Subagent panels). With either, it becomes the panel's full-width header strip: the heading
 * (plus an optional info button) on the left, an optional `right` slot (a total or a badge) on the right,
 * and — when `info` is set — a description popover that drops below the strip on hover or keyboard focus.
 * The popover spans the strip's full width and opens downward, so it can never clip past the rail edge.
 */
export function PanelHeading({
  children,
  info,
  right,
}: {
  children: ReactNode
  info?: ReactNode
  right?: ReactNode
}) {
  if (!info && !right) {
    return <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{children}</h2>
  }
  const label = typeof children === 'string' ? `About ${children}` : 'About this metric'
  return (
    <div className="group relative flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{children}</h2>
        {info && (
          <button
            type="button"
            aria-label={label}
            className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-full text-fg-faint transition-colors hover:text-fg-muted focus-visible:text-fg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <Icon name="info" size={12} />
          </button>
        )}
      </span>
      {right}
      {info && (
        <span
          role="note"
          className="pointer-events-none absolute left-0 right-0 top-full z-20 mt-1.5 hidden rounded-md border border-ink-700 bg-ink-900 px-2.5 py-2 text-[11px] leading-snug text-fg-muted shadow-lg group-hover:block group-focus-within:block"
        >
          {info}
        </span>
      )}
    </div>
  )
}
