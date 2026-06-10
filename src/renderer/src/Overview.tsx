import { useMemo, useState, type ReactNode } from 'react'
import type { Session, ProviderCapabilities } from '@shared/types'
import type { Stats } from '@shared/stats'
import { pinWaiting, sortSessions, filterSessions, stateCounts, type SortKey, type Filter } from '@shared/overview'
import { formatUsd, formatRelativeTime } from '@shared/format'
import { STATE_META, MODEL_LABEL, ctxTone, ctxBar } from './ui/meta'
import { cx, Dot, ManagementChip, ModelChip, Bar } from './ui/atoms'

/** Projects shown in the rail rollup before collapsing the rest into a "+N more" row. */
const TOP_PROJECTS = 8

/** Filter chips, in display order: 'all', then the four states loudest-first. */
const FILTERS: Filter[] = ['all', 'waiting', 'working', 'idle', 'ended']

interface Props {
  sessions: Session[]
  caps: ProviderCapabilities | null
  stats: Stats | null
  loading: boolean
  onRefresh: () => void
  onOpen: (session: Session) => void
  onNew: () => void
}

export function Overview({ sessions, caps, stats, loading, onRefresh, onOpen, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SortKey>('default')
  // One timestamp per render for every relative-time label; the 3s background re-sync re-renders and
  // refreshes it, so sub-second drift never shows.
  const now = Date.now()

  const counts = useMemo(() => stateCounts(sessions), [sessions])
  // The strip shows every Waiting session, independent of the table's filter/sort — its whole job is
  // to never let a sort bury them.
  const waiting = useMemo(() => filterSessions(sessions, 'waiting'), [sessions])
  // Table pipeline: filter by the active chip, sort by the active column, then pin Waiting last so they
  // stay on top no matter the sort.
  const rows = useMemo(
    () => pinWaiting(sortSessions(filterSessions(sessions, filter), sort)),
    [sessions, filter, sort],
  )

  return (
    <div className="app-bg flex h-screen flex-col text-fg">
      <header className="flex shrink-0 items-center gap-4 border-b border-ink-800 px-5 py-3">
        <h1 className="text-base font-semibold">code-by-wire</h1>
        <span className="text-[13px] text-fg-muted">
          {sessions.length} session{sessions.length === 1 ? '' : 's'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onNew}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-primary-bright"
          >
            ＋ New session
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="rounded-md border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs text-fg transition-colors hover:bg-ink-750 disabled:cursor-default disabled:opacity-60"
          >
            {loading ? 'Syncing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Rail stats={stats} caps={caps} />

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-ink-800 px-5 py-3">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cx(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs capitalize transition-colors',
                  filter === f ? 'bg-ink-750 text-fg' : 'text-fg-muted hover:bg-ink-850',
                )}
              >
                {f !== 'all' && <Dot state={f} />}
                {f}
                <span className="font-mono text-[10px] text-fg-faint">{counts[f]}</span>
              </button>
            ))}
          </div>

          <NeedsYouStrip waiting={waiting} now={now} onOpen={onOpen} />

          <div className="min-h-0 flex-1 overflow-auto">
            {sessions.length === 0 ? (
              // Stay blank while the first sync is in flight; only call it empty once it has finished.
              loading ? null : <p className="px-5 py-6 text-sm text-fg-muted">No Claude Code sessions found.</p>
            ) : rows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-fg-muted">No {filter} sessions.</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-ink-925 text-left">
                  <tr className="text-[10px] uppercase tracking-wider text-fg-faint">
                    <Th>State</Th>
                    <Th>Session</Th>
                    <Th>Model</Th>
                    <Th sortable sortKey="ctx" active={sort === 'ctx'} onSort={setSort}>Context</Th>
                    <Th sortable sortKey="value" active={sort === 'value'} onSort={setSort} right>~Value</Th>
                    <Th sortable sortKey="last" active={sort === 'last'} onSort={setSort} right>Last</Th>
                    <Th right title="Lines changed — available once the statusLine side-channel lands (#11)">Lines</Th>
                    <Th>Activity</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const isWaiting = s.state === 'waiting'
                    return (
                      <tr
                        key={s.id}
                        className={cx('row-clickable border-b border-ink-800/70', isWaiting && 'bg-accent/[0.06]')}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${s.title}`}
                        onClick={() => onOpen(s)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onOpen(s)
                          }
                        }}
                      >
                        <td className={cx('py-2.5 pl-5 pr-3', isWaiting && 'border-l-2 border-accent')}>
                          <span className={cx('inline-flex items-center gap-1.5 text-[11px]', STATE_META[s.state].text)}>
                            <Dot state={s.state} />
                            {STATE_META[s.state].label}
                          </span>
                        </td>
                        <td className="max-w-[340px] py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <ManagementChip kind={s.management} />
                            <span className="truncate text-[13px] text-fg">{s.title}</span>
                          </div>
                          <div className="truncate font-mono text-[10px] text-fg-faint">
                            {s.project}{s.branch ? ` · ${s.branch}` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3"><ModelChip model={s.model} /></td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <Bar pct={s.contextPct} fill={ctxBar(s.contextPct)} className="w-16" />
                            <span className={cx('font-mono text-[11px] tabular-nums', ctxTone(s.contextPct))}>{s.contextPct}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono text-[11px] tabular-nums text-fg-muted">~{formatUsd(s.equivApiValueUsd)}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-[11px] tabular-nums text-fg-faint">{formatRelativeTime(s.lastActivityMs, now)}</td>
                        {/* Lines changed: no data source until the statusLine side-channel (#11); placeholder for now. */}
                        <td className="py-2.5 pr-3 text-right font-mono text-[11px] tabular-nums text-fg-faint">—</td>
                        <td className="max-w-[260px] py-2.5 pr-5">
                          <span className={cx('block truncate text-[11px]', isWaiting ? 'text-accent-bright' : 'text-fg-muted')}>
                            {isWaiting ? `⚠ ${s.waitingReason ?? 'Waiting on you'}` : (s.currentTask ?? '')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

/** A table header cell; sortable ones render a button that toggles to their column and show a ▼/⇅ glyph. */
function Th({
  children,
  sortable,
  sortKey,
  active,
  onSort,
  right,
  title,
}: {
  children: ReactNode
  sortable?: boolean
  sortKey?: SortKey
  active?: boolean
  onSort?: (k: SortKey) => void
  right?: boolean
  title?: string
}) {
  return (
    <th
      title={title}
      aria-sort={sortable ? (active ? 'descending' : 'none') : undefined}
      className={cx('whitespace-nowrap px-3 py-2.5 font-semibold', right && 'text-right')}
    >
      {sortable && sortKey && onSort ? (
        <button
          onClick={() => onSort(sortKey)}
          className={cx('inline-flex items-center gap-1 hover:text-fg-muted', active && 'text-primary-bright', right && 'w-full justify-end')}
        >
          {children}
          <span className="text-[8px]">{active ? '▼' : '⇅'}</span>
        </button>
      ) : (
        children
      )}
    </th>
  )
}

/** Waiting sessions as amber action cards, always above the table. Collapses to a slim reassurance
 *  line when nothing is Waiting, so the table stays high. */
function NeedsYouStrip({ waiting, now, onOpen }: { waiting: Session[]; now: number; onOpen: (s: Session) => void }) {
  if (waiting.length === 0) {
    return (
      <div className="shrink-0 border-b border-ink-800 px-5 py-2 text-[11px] text-fg-faint">
        <span className="text-ok">✓</span> Nothing waiting on you.
      </div>
    )
  }
  return (
    <div className="max-h-[38vh] shrink-0 overflow-y-auto border-b border-ink-800 px-5 py-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-accent-bright">Needs you</h2>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[11px] text-accent-bright">{waiting.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        {waiting.map((s) => (
          <button
            key={s.id}
            onClick={() => onOpen(s)}
            className="block w-full rounded-lg border border-accent/50 bg-accent/[0.07] p-3 text-left transition-colors hover:bg-accent/[0.12]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-fg">
                <span className="h-2 w-2 shrink-0 animate-pulse-soft rounded-full bg-accent" />
                <span className="truncate">{s.title}</span>
              </span>
              <ManagementChip kind={s.management} />
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-fg-faint">
              {s.project}{s.branch ? ` · ${s.branch}` : ''}
            </div>
            <div className="mt-2 truncate rounded-md border border-accent/25 bg-ink-950/40 px-2.5 py-1.5 font-mono text-[12px] text-accent-bright">
              {s.waitingReason ?? 'Waiting on you'}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="rounded bg-accent px-2.5 py-1 text-xs font-semibold text-ink-950">Respond →</span>
              <span className="font-mono text-[11px] text-fg-faint">{formatRelativeTime(s.lastActivityMs, now)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Left ops rail: the usage stats we have (This week, Model mix, By project) plus a capability line.
 *  Rate-limit bars are issue #11 (no Account data reaches the renderer yet), so they are intentionally
 *  absent — ADR-0001's graceful degradation. Hidden below the `lg` breakpoint. */
function Rail({ stats, caps }: { stats: Stats | null; caps: ProviderCapabilities | null }) {
  const weekTotal = stats ? stats.weeklyActivity.reduce((sum, d) => sum + d.equivApiValueUsd, 0) : 0
  const maxValue = stats ? Math.max(0, ...stats.weeklyActivity.map((d) => d.equivApiValueUsd)) : 0

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-ink-800 bg-ink-925 p-4 lg:flex">
      {stats && (
        <>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">This week</div>
            <div className="font-mono text-xl text-fg">~{formatUsd(weekTotal)}</div>
            <div
              role="img"
              aria-label={`Activity over the last 7 days, ~${formatUsd(weekTotal)} equivalent API value`}
              className="mt-2 flex h-9 items-end gap-1"
            >
              {stats.weeklyActivity.map((d) => (
                <div
                  key={d.dayStartMs}
                  title={`${weekdayUtc(d.dayStartMs)}: ${d.sessions} session${d.sessions === 1 ? '' : 's'} · ~${formatUsd(d.equivApiValueUsd)}`}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-sm bg-primary"
                      style={{
                        height: `${maxValue > 0 ? (d.equivApiValueUsd / maxValue) * 100 : 0}%`,
                        minHeight: d.sessions > 0 ? 2 : 0,
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-fg-faint">{weekdayUtc(d.dayStartMs)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-ink-800 pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Model mix</div>
            {stats.modelMix.length === 0 ? (
              <span className="text-[11px] text-fg-faint">No usage yet.</span>
            ) : (
              <div className="space-y-1">
                {stats.modelMix.map((m) => (
                  <div key={m.model} className="flex items-center justify-between">
                    <span className="text-[12px] text-fg">{MODEL_LABEL[m.model]}</span>
                    <span className="ml-2 shrink-0 font-mono text-[10px] tabular-nums text-fg-muted">{m.sessions} · ~{formatUsd(m.equivApiValueUsd)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-ink-800 pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">By project</div>
            {stats.projectRollup.length === 0 ? (
              <span className="text-[11px] text-fg-faint">No usage yet.</span>
            ) : (
              <div className="space-y-1">
                {stats.projectRollup.slice(0, TOP_PROJECTS).map((p) => (
                  <div key={p.project} className="flex items-center justify-between">
                    <span className="truncate font-mono text-[11px] text-fg">{p.project}</span>
                    <span className="ml-2 shrink-0 font-mono text-[10px] tabular-nums text-fg-faint">{p.sessions} · ~{formatUsd(p.equivApiValueUsd)}</span>
                  </div>
                ))}
                {stats.projectRollup.length > TOP_PROJECTS && (
                  <div className="text-[10px] text-fg-faint">+{stats.projectRollup.length - TOP_PROJECTS} more</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {caps && (
        <div className="mt-auto border-t border-ink-800 pt-3 text-[11px] text-fg-faint">
          ClaudeProvider · control {caps.canControl ? '✓' : '✗'} · limits {caps.hasRateLimits ? '✓' : '✗'} · subagents {caps.hasSubagents ? '✓' : '✗'}
        </div>
      )}
    </aside>
  )
}

/** Short UTC weekday label for a day bucket — UTC to match the UTC-day bucketing in computeStats. */
function weekdayUtc(dayStartMs: number): string {
  return new Date(dayStartMs).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}
