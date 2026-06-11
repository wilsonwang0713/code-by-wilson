import { useId, type ReactNode } from 'react'
import { Icon } from '../../ui/icons'

// Shared chrome for the workspace rail panels, so a retone lands in one place.

/** A rail panel's shell: vertical rhythm, a bottom hairline, and bottom padding. */
export function PanelSection({ children }: { children: ReactNode }) {
  return <section className="space-y-2 border-b border-ink-800 pb-3.5 last:border-0">{children}</section>
}

/**
 * A panel's small uppercase eyebrow heading. With no `info`/`right` it is the bare h2 (unchanged for the
 * Git/Tasks/Subagent panels). With either, it becomes the panel's full-width header strip: the heading
 * (plus an optional info button) on the left, an optional `right` slot (a total or a badge) on the right.
 * When `info` is set the info button reveals a description popover on hover or keyboard focus — scoped to
 * the button alone (its own `group`), so hovering the heading text or the `right` slot never triggers it.
 * The popover anchors to the strip, so it spans the full width and drops downward below the strip.
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
  // A unique id wiring the info button to its description via aria-describedby (the CSS-only reveal never
  // reaches the accessibility tree). useId runs before the early return so the hook order stays stable.
  const tooltipId = useId()
  if (!info && !right) {
    return <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{children}</h2>
  }
  const title = typeof children === 'string' ? children : undefined
  return (
    <div className="relative flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{children}</h2>
        {info && (
          // The `group` scopes the hover/focus reveal to the button (and the popover itself); the popover
          // stays `absolute` against the outer relative strip, so left-0/right-0 still span its full width.
          // inline-flex + items-center hugs the wrapper to the button so it centers on the heading text
          // instead of riding the inline strut's baseline.
          <span className="group inline-flex items-center">
            <button
              type="button"
              aria-label={title ? `About ${title}` : 'About this metric'}
              aria-describedby={tooltipId}
              className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-full text-fg-faint transition-colors hover:text-fg-muted focus-visible:text-fg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            >
              <Icon name="info" size={12} />
            </button>
            <span
              role="tooltip"
              id={tooltipId}
              className="absolute left-0 right-0 top-full z-20 mt-1.5 hidden rounded-md border border-ink-700 bg-ink-900 px-2.5 py-2 text-[11px] leading-snug text-fg-muted shadow-lg group-hover:block group-focus-within:block"
            >
              {info}
            </span>
          </span>
        )}
      </span>
      {right}
    </div>
  )
}
