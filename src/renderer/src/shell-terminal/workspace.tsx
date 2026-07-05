import { useStore } from "@nanostores/react";
import { TerminalInstance } from "./instance";
import { $activeTerminalId, $terminals } from "./terminals";

/** The persistent-overlay layer: the stack of live xterm instances (only these must stay in the
 *  fixed overlay, for the WebGL host). Mount/visibility is owned by PersistentTerminal (latched so
 *  shells survive hiding); the tab rail lives in the pane DOM — see TerminalPaneChrome. */
export function TerminalWorkspace() {
  const terminals = useStore($terminals);
  const activeId = useStore($activeTerminalId);

  return (
    <>
      {terminals.map((term) => (
        <TerminalInstance
          active={term.id === activeId}
          cwd={term.cwd}
          id={term.id}
          key={term.id}
          reviveBuffer={term.reviveBuffer}
        />
      ))}
    </>
  );
}
