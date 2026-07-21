import { useStore } from "@nanostores/react";
import { Card } from "../shell/page-primitives";
import { cx } from "../ui/atoms";
import {
  $notifyOnAwaiting,
  $notifyOnFinished,
  setNotifyOnAwaiting,
  setNotifyOnFinished,
} from "../notifications/store";

/** One labelled switch row. The switch anatomy mirrors the Software-update card's check-on-launch
 *  row; extracted here so both notification toggles render identically (icon-free, same size). */
function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-body text-fg">{title}</div>
        <div className="mt-0.5 text-meta text-fg-faint">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onToggle(!enabled)}
        className={cx(
          "relative h-[18px] w-8 shrink-0 rounded-full transition-colors",
          enabled ? "bg-primary" : "bg-ink-700",
        )}
      >
        <span
          className={cx(
            "absolute top-[2px] h-[14px] w-[14px] rounded-full transition-all",
            enabled ? "right-[2px] bg-ink-900" : "left-[2px] bg-white",
          )}
        />
      </button>
    </div>
  );
}

/**
 * The Notifications card in Settings → System: the awaiting-input toggle and the session-finished
 * toggle. Each reads and writes its shared preference atom (notifications/store.ts) so the poll
 * detector reacts to a flip on the very next tick — no restart, no re-fetch.
 */
export function NotificationsCard() {
  const notifyOnAwaiting = useStore($notifyOnAwaiting);
  const notifyOnFinished = useStore($notifyOnFinished);
  return (
    <Card title="Notifications">
      <ToggleRow
        title="Notify when a session needs input"
        description="Show a system notification when a session starts waiting on you"
        enabled={notifyOnAwaiting}
        onToggle={setNotifyOnAwaiting}
      />
      <ToggleRow
        title="Notify when a session finishes"
        description="Show a system notification when a session finishes running"
        enabled={notifyOnFinished}
        onToggle={setNotifyOnFinished}
      />
    </Card>
  );
}
