import { Icon } from "../ui/icons";

export function AppFooter({ version }: { version: string | null }) {
  return (
    <footer className="no-drag flex h-8 shrink-0 items-center justify-between border-t border-ink-800 bg-ink-925 px-3">
      <div className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 rounded bg-gradient-to-br from-primary to-primary-deep" />
        <span className="text-[12px] font-semibold text-fg">code-by-wire</span>
        <span className="font-mono text-[11px] text-fg-faint">
          {version ? `v${version}` : "—"}
        </span>
      </div>
      <button
        type="button"
        disabled
        title="Terminal — coming soon"
        aria-label="Terminal (coming soon)"
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-ink-800 text-fg-faint opacity-40"
      >
        <Icon name="square-terminal" size={14} />
      </button>
    </footer>
  );
}
