import { useContext, type ReactNode } from "react";
import { PaneShellContext } from "./pane-shell-context";

export function MainColumn({ children }: { children: ReactNode }) {
  const ctx = useContext(PaneShellContext);
  const col = ctx ? `${ctx.mainColumn} / ${ctx.mainColumn + 1}` : undefined;
  return (
    <div className="flex min-h-0 min-w-0 flex-col" style={{ gridColumn: col }}>
      {children}
    </div>
  );
}
