import type { ReactNode } from "react";
import { cx } from "../ui/atoms";

/** Hermes's shared sidebar section label (their app/shell/sidebar-label.tsx): the 0.64rem
 *  uppercase overline with the dither dot, shared by the left sidebar's section header and the
 *  right rail's panel headings so the treatment can't drift. */
export function SidebarPanelLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "flex min-w-0 items-center gap-2 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-(--theme-primary)",
        className,
      )}
    >
      <span className="dither inline-block size-2 shrink-0 rounded-[1px]" />
      <span className="min-w-0 truncate leading-none">{children}</span>
    </span>
  );
}
