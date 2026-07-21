import { atom } from "nanostores";

/**
 * The "Notch overlay" preference, mirrored for the Settings card. Main's app-settings file is
 * the durable source of truth; this atom is the in-run mirror, seeded at card mount
 * (initIslandEnabled) and written through on toggle — mirroring notifications/store.ts. Defaults
 * OFF: the island is opt-in (spec US-5 AC4), so the seed only ever confirms or turns it on.
 */
export const $islandEnabled = atom(false);

/** Seed the atom from the persisted setting. A failed read keeps the default (off), matching
 *  main's `?? false` posture. */
export async function initIslandEnabled(): Promise<void> {
  try {
    $islandEnabled.set(await window.api.getIslandEnabled());
  } catch {
    // Keep the default; a failed read must not throw out of a mount effect.
  }
}

/** Flip the preference: atom first (the card reacts immediately), then persist — main also
 *  creates/destroys the overlay window inside this call, so no restart is needed (US-5 AC1). */
export function setIslandEnabled(enabled: boolean): void {
  $islandEnabled.set(enabled);
  void window.api.setIslandEnabled(enabled).catch(() => {});
}
