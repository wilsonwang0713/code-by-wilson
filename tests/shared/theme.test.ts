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
  it("falls back to light (the app default) for anything else", () => {
    expect(normalizeThemePreference(undefined)).toBe("light");
    expect(normalizeThemePreference(null)).toBe("light");
    expect(normalizeThemePreference("Light")).toBe("light");
    expect(normalizeThemePreference(42)).toBe("light");
    expect(normalizeThemePreference("")).toBe("light");
  });
  it("lists exactly the three preferences", () => {
    expect(THEME_PREFERENCES).toEqual(["system", "light", "dark"]);
  });
});
