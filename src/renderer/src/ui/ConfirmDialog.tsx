import { useEffect, useRef } from "react";

/** A minimal confirm/cancel modal, gating a risky action behind an explicit choice. Mirrors the
 *  NewSessionDialog chrome (overlay, centered panel, Escape to cancel, focus restored on close) without
 *  its form. The body carries the warning; the confirm button proceeds. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Focus the panel on open and restore focus to whatever had it when the dialog closes, so keyboard
  // users aren't stranded on the now-obscured app behind the overlay.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => prev?.focus?.();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        tabIndex={-1}
        className="w-[26rem] rounded-xl border border-ink-700 bg-ink-900 p-5 text-fg shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div id="confirm-title" className="text-sm font-semibold">
          {title}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-fg-faint">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[13px] text-fg-muted transition-colors hover:text-fg"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-ink-950 ring-1 ring-primary/40 transition-colors hover:bg-primary-bright"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
