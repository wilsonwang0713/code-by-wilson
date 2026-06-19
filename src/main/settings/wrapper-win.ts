import type { WrapperSpec } from "./wrapper";

/** The call-through line bakes the user's command after this prefix; recoverWrappedCommandWin reads it back. */
const CALL_THROUGH_PREFIX = "# CBW_CALL_THROUGH: ";

/** The fixed script tail emitted after the (optional) call-through line. */
const SCRIPT_TAIL = "# CBW_END\n";

/**
 * PowerShell statusLine wrapper (ADR-0001) for Windows. Captures Claude Code's stdin JSON to a
 * per-session side-channel file under the capture dir next to this script, then calls through to
 * the user's original command so their prompt still renders. Best-effort throughout; never fails
 * the prompt. The wrapped command is baked between CALL_THROUGH_PREFIX and SCRIPT_TAIL so
 * recoverWrappedCommandWin is its exact inverse.
 *
 * The capture dir is `<scriptdir>/statusline/` (relative, via $PSScriptRoot) so a Claude dir
 * containing special characters can't corrupt the script. session_id is extracted via regex.
 * An id containing a path separator is rejected (no traversal out of the capture dir). The
 * capture is published via tmp-then-rename (WriteAllText + Move-Item -Force) so a reader never
 * sees a half-written file. $ErrorActionPreference = 'SilentlyContinue' keeps all capture steps
 * best-effort; the script always exits cleanly.
 */
export function wrapperScriptWin({ wrappedCommand }: WrapperSpec): string {
  const callThrough =
    wrappedCommand && wrappedCommand.trim() !== ""
      ? `${CALL_THROUGH_PREFIX}${wrappedCommand}\n` +
        `$json | & cmd /c ${JSON.stringify(wrappedCommand)} 2>$null\n`
      : "";
  return (
    `# code-by-wire statusLine wrapper (PowerShell) — AUTO-GENERATED, do not edit.\n` +
    `$ErrorActionPreference = 'SilentlyContinue'\n` +
    `$json = [Console]::In.ReadToEnd()\n` +
    `$dir = Join-Path $PSScriptRoot 'statusline'\n` +
    `New-Item -ItemType Directory -Force -Path $dir | Out-Null\n` +
    `$sid = if ($json -match '"session_id"\\s*:\\s*"([^"]+)"') { $Matches[1] } else { $null }\n` +
    `if ($sid -and $sid -notmatch '[\\\\/]') {\n` +
    `  $tmp = Join-Path $dir ($PID.ToString() + '.tmp')\n` +
    `  [IO.File]::WriteAllText($tmp, $json)\n` +
    `  Move-Item -Force $tmp (Join-Path $dir ($sid + '.json'))\n` +
    `}\n` +
    callThrough +
    SCRIPT_TAIL
  );
}

/** Recover the wrapped command baked into a Windows wrapper — exact inverse of wrapperScriptWin. */
export function recoverWrappedCommandWin(src: string): string | null {
  const start = src.indexOf(CALL_THROUGH_PREFIX);
  if (start === -1) return null;
  const after = src.slice(start + CALL_THROUGH_PREFIX.length);
  const nl = after.indexOf("\n");
  return nl === -1 ? null : after.slice(0, nl);
}
