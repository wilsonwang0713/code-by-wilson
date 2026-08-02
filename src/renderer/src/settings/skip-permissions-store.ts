import { atom } from "nanostores";

/**
 * The "Skip permission prompts on new sessions" preference (`--dangerously-skip-permissions`).
 * Main's app-settings file is the durable source of truth; this atom mirrors it for the CLI card,
 * which is its only renderer-side consumer — the flag itself is read server-side at spawn time
 * (terminal/ipc.ts's resolveSkipPermissions), not from here. Defaults off: it bypasses Claude
 * Code's own confirmation prompts, so it stays opt-in like the island preference.
 */
export const $skipPermissions = atom(false);

/** Seed the atom from the persisted setting. Called once from CliCard's mount effect; a failed
 *  read keeps the default (off) rather than throwing for a cosmetic setting. */
export async function initSkipPermissions(): Promise<void> {
  try {
    $skipPermissions.set(await window.api.getSkipPermissions());
  } catch {
    // Keep the default (off).
  }
}

/** Flip the preference: atom first (the card reacts immediately), then persist. Fire-and-forget
 *  on the write — a failed persist costs durability, not this run's behavior. */
export function setSkipPermissions(enabled: boolean): void {
  $skipPermissions.set(enabled);
  void window.api.setSkipPermissions(enabled).catch(() => {});
}
