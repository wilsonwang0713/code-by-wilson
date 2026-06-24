import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cx, focusRingInset } from "../../ui/atoms";

// Shared row grammar for the Structure dock tabs (Tasks / Subagents / Shells / Turns): a fixed status
// gutter, a flex-1 truncating label, and a right-aligned mono metric rack. Rows are transparent and split
// by a hairline; interactive rows hover and carry the inset focus ring. A `fill` node renders as a
// full-bleed band behind the content, used by the Subagents Gantt. Restyling the dock lands here once.

/** The leading-slot width: wide enough for a status glyph or a two-digit turn index. */
export const DOCK_GUTTER = "w-6";

/** One dock row. A `<button>` when `onClick` is given, otherwise a `<div>`. `children` is the label. */
export function DockRow({
  leading,
  trailing,
  fill,
  active = false,
  onClick,
  className,
  children,
  ...rest
}: {
  leading?: ReactNode;
  trailing?: ReactNode;
  fill?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "onClick">) {
  const base = cx(
    "relative flex min-h-[26px] w-full items-center gap-2 border-b border-ink-850 px-3 text-left last:border-0",
    active && "bg-ink-850",
    className,
  );
  const inner = (
    <>
      {fill}
      <span className="relative flex w-full items-center gap-2">
        {leading}
        {children}
        {trailing}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cx(
          base,
          "transition-colors hover:bg-ink-900/60",
          focusRingInset,
        )}
        {...(rest as ComponentPropsWithoutRef<"button">)}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={base} {...rest}>
      {inner}
    </div>
  );
}

/** The right-aligned metric cluster shared by every dock row. */
export function MetricRack({ children }: { children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] tabular-nums">
      {children}
    </span>
  );
}

/** One right-aligned mono metric. `unit`, when present, renders dimmed after the value so the number
 *  leads regardless of the value's own tone. `width` fixes the column so values line up down the panel. */
export function MetricCell({
  width,
  tone = "text-fg-faint",
  unit,
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"span"> & {
  width?: string;
  tone?: string;
  unit?: string;
}) {
  return (
    <span
      className={cx(
        "shrink-0 text-right font-mono text-[10px] tabular-nums",
        width,
        tone,
        className,
      )}
      {...rest}
    >
      {children}
      {unit && <span className="ml-0.5 text-fg-faint">{unit}</span>}
    </span>
  );
}
