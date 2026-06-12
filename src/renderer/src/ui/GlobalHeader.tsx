import { Wordmark, cx } from './atoms'
import { useZoomFactor } from './use-zoom-factor'
import { HEADER_HEIGHT_PX, MAC_TRAFFIC_LIGHT_INSET_PX } from '@shared/chrome'
import { isMacPlatform } from '@shared/platform'

/**
 * The frameless app's title bar: a draggable strip carrying the wordmark. On macOS it reserves a left
 * inset for the native traffic lights and counter-zooms (the
 * `title-bar` class) so it holds a fixed physical size while the rest of the window zooms — otherwise
 * web zoom shrinks the bar under the OS-drawn traffic lights, which don't zoom, and they hang off it.
 * Off macOS there are no traffic lights to align with, so the bar zooms with everything else. Account
 * identity, rate limits, and the New session action now live in the rail, so this bar is just brand.
 */
export function GlobalHeader() {
  const isMac = isMacPlatform(window.api.platform)
  useZoomFactor(isMac)
  return (
    <header
      className={cx(
        'drag-region flex shrink-0 select-none items-center overflow-hidden border-b border-ink-800 bg-ink-925 pr-4',
        isMac && 'title-bar',
      )}
      style={{ height: HEADER_HEIGHT_PX, paddingLeft: isMac ? MAC_TRAFFIC_LIGHT_INSET_PX : 16 }}
    >
      {/* Equal-weight spacers flank the wordmark so it centers in the usable bar (between the macOS
          traffic-light inset and the right edge). Everything stays in flow. */}
      <div className="flex-1" />
      <Wordmark />
      <div className="flex-1" />
    </header>
  )
}
