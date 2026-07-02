import type { Session } from "@shared/types";
import { formatRelativeTime } from "@shared/format";
import { cx, Dot } from "../ui/atoms";
import { Icon } from "../ui/icons";

/**
 * The hermes single-line sidebar row: a 26px-tall strip with a state `Dot`, the title, and — revealed
 * on hover — a relative-time stamp and a copy-ID button. No project·branch line and no context-%
 * chip; those moved to the right sidebar's Git row. A `<button>` can't nest another, so the root is a
 * `div` wrapping two sibling buttons: the main select button (dot + title + timestamp) fills the row,
 * and a small copy-ID button sits to its right — clicking it copies the session id without selecting
 * the row, since the two controls never overlap.
 */
export function SessionRow({
  session,
  selected,
  now,
  onSelect,
}: {
  session: Session;
  selected: boolean;
  /** One timestamp shared across the visible rows for the relative-time labels; the caller
   *  re-renders every few seconds to keep it fresh. */
  now: number;
  onSelect: () => void;
}) {
  return (
    <div
      className={cx(
        "group grid min-h-[1.625rem] grid-cols-[minmax(0,1fr)_auto] items-stretch rounded-md transition-colors duration-100 ease-out hover:transition-none",
        selected
          ? "bg-(--ui-row-active-background)"
          : "hover:bg-(--ui-row-hover-background)",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Open ${session.title}`}
        className="flex h-full min-w-0 cursor-pointer items-center gap-1.5 self-stretch py-0.5 pl-2 pr-1 text-left"
      >
        <span className="grid size-3.5 shrink-0 place-items-center">
          <Dot
            state={session.state}
            management={session.management}
            sizeClass={
              session.state === "idle" ? "h-1 w-1 opacity-80" : "h-1.5 w-1.5"
            }
          />
        </span>
        <span
          className={cx(
            "min-w-0 flex-1 truncate text-[0.8125rem] leading-none text-(--ui-text-secondary) group-hover:text-fg",
            selected && "text-fg",
          )}
          title={session.title}
        >
          {session.title}
        </span>
        <span className="shrink-0 font-mono text-[0.625rem] leading-none text-(--ui-text-tertiary) tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
          {formatRelativeTime(session.lastActivityMs, now)}
        </span>
      </button>
      <span className="relative grid w-[1.375rem] place-items-center">
        <button
          type="button"
          aria-label="Copy session ID"
          title="Copy session ID"
          onClick={() => void window.api.clipboardWriteText(session.id)}
          className="grid size-5 cursor-pointer place-items-center rounded-[4px] text-transparent transition-colors hover:bg-(--ui-control-active-background) group-hover:text-(--ui-text-tertiary) hover:group-hover:text-fg"
        >
          <Icon name="copy" size={14} />
        </button>
      </span>
    </div>
  );
}
