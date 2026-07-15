/** The user's theme choice. "system" follows the OS via nativeTheme; light/dark force it. */
export type ThemePreference = "system" | "light" | "dark";

/** The three selectable preferences, in display order (the Appearance card's segments). */
export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "system",
  "light",
  "dark",
] as const;

/** Coerce an untrusted value (IPC arg, persisted JSON) to a valid preference; unknown → "system".
 *  The single validation point for the theme preference, shared by main (IPC + boot) and renderer. */
export function normalizeThemePreference(v: unknown): ThemePreference {
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}
