import { useEffect } from "react";
import { useStore } from "@nanostores/react";
import { Card } from "../shell/page-primitives";
import { cx } from "../ui/atoms";
import {
  $islandEnabled,
  initIslandEnabled,
  setIslandEnabled,
} from "../island/store";

/**
 * The Notch overlay card in Settings → System: the island on/off toggle. macOS-only — the mount
 * site gates on platform === "darwin" (the Windows floating widget is P2). The switch anatomy
 * mirrors NotificationsCard; the atom seed happens here (not in a poll hook) because this card
 * is the preference's only renderer-side consumer.
 */
export function IslandCard() {
  const enabled = useStore($islandEnabled);
  useEffect(() => {
    void initIslandEnabled();
  }, []);
  return (
    <Card title="Notch overlay">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <div className="text-body text-fg">Show the island</div>
          <div className="mt-0.5 text-meta text-fg-faint">
            A pill under the notch showing which sessions need you; click a
            session to jump to it
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setIslandEnabled(!enabled)}
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
    </Card>
  );
}
