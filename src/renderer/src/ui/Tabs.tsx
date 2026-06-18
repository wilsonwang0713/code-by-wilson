import { cx } from "./atoms";
import { Icon, type IconName } from "./icons";

/** One tab in a {@link Tabs} bar. */
export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Optional leading glyph (the center column's Terminal/Transcript tabs). */
  icon?: IconName;
  /** Optional trailing count badge (the dock's Tasks/Subagents/Shells/Turns tabs). */
  count?: number;
}

/** The two tab looks: `underline` for the primary view switch (center column), `lozenge` for the
 *  utility dock. Both are trackless — the old bordered pill is retired. */
export type TabsVariant = "underline" | "lozenge";

/**
 * The app's tab control. One primitive, two variants so the center column's Terminal/Transcript switch
 * and the Structure dock's tab bar share their icon/count/selection logic while reading distinct by role.
 * Each tab can carry a leading icon, a trailing count, or both.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  variant,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant: TabsVariant;
}) {
  return (
    <div
      className={
        variant === "lozenge"
          ? "inline-flex items-center gap-0.5"
          : "flex items-stretch"
      }
    >
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={active}
            className={cx(
              "inline-flex items-center gap-1.5 text-[12px] transition-colors",
              variant === "lozenge"
                ? active
                  ? "rounded px-2.5 py-1 bg-ink-900 font-semibold text-fg"
                  : "rounded px-2.5 py-1 text-fg-faint hover:text-fg"
                : active
                  ? "-mb-px border-b-2 border-primary px-3 font-semibold text-fg"
                  : "-mb-px border-b-2 border-transparent px-3 text-fg-faint hover:text-fg",
            )}
          >
            {t.icon && <Icon name={t.icon} size={13} />}
            {t.label}
            {t.count !== undefined && (
              <span className="font-mono text-[10px] tabular-nums text-fg-faint">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
