import type { Session } from "@shared/types";
import { cx, Dot } from "../ui/atoms";

/**
 * The hermes single-line sidebar row: a 26px-tall strip with a state `Dot` and the title — one
 * plain select button, no hover extras. The relative-time stamp moved to the right sidebar's
 * Session panel (Active row), and the copy-ID button is gone with it; no project·branch line and
 * no context-% chip either, which also live in the right sidebar now.
 */
export function SessionRow({
  session,
  selected,
  onSelect,
}: {
  session: Session;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Open ${session.title}`}
      className={cx(
        "group flex min-h-[1.625rem] min-w-0 cursor-pointer items-center gap-1.5 rounded-md py-0.5 pl-2 pr-2 text-left transition-colors duration-100 ease-out hover:transition-none",
        selected
          ? "bg-(--ui-row-active-background)"
          : "hover:bg-(--ui-row-hover-background)",
      )}
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
    </button>
  );
}
