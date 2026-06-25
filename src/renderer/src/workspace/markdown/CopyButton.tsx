import { useEffect, useRef, useState } from "react";
import { cx } from "../../ui/atoms";
import { Icon } from "../../ui/icons";

/**
 * Copy-to-clipboard affordance shared by code blocks and assistant bubbles. Writes via the app's
 * clipboard IPC, then flips to a check for ~1.5s. The parent controls visibility (opacity / reveal)
 * through `className` plus a named group; `revealLabelOnHover` hides the label until group hover.
 */
export function CopyButton({
  text,
  label,
  revealLabelOnHover = false,
  className,
}: {
  text: string;
  label?: string;
  revealLabelOnHover?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onClick = () => {
    void window.api.clipboardWriteText(text);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Copy"
      className={cx(
        "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-fg-faint transition-colors hover:text-fg",
        className,
      )}
    >
      <Icon
        name={copied ? "check" : "copy"}
        size={12}
        className={copied ? "text-ok" : undefined}
      />
      {label && (
        <span
          className={cx(
            copied && "text-ok",
            revealLabelOnHover && !copied && "hidden group-hover/msg:inline",
          )}
        >
          {copied ? "Copied" : label}
        </span>
      )}
    </button>
  );
}
