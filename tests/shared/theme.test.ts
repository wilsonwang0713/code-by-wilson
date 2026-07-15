import { describe, it, expect } from "vitest";
import {
  normalizeThemePreference,
  THEME_PREFERENCES,
} from "../../src/shared/theme";

describe("normalizeThemePreference", () => {
  it("passes valid preferences through", () => {
    expect(normalizeThemePreference("system")).toBe("system");
    expect(normalizeThemePreference("light")).toBe("light");
    expect(normalizeThemePreference("dark")).toBe("dark");
  });
  it("falls back to system for anything else", () => {
    expect(normalizeThemePreference(undefined)).toBe("system");
    expect(normalizeThemePreference(null)).toBe("system");
    expect(normalizeThemePreference("Light")).toBe("system");
    expect(normalizeThemePreference(42)).toBe("system");
    expect(normalizeThemePreference("")).toBe("system");
  });
  it("lists exactly the three preferences", () => {
    expect(THEME_PREFERENCES).toEqual(["system", "light", "dark"]);
  });
});
