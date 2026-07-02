import { describe, it, expect } from "vitest";
import { reviewTone, reviewLabel } from "../../src/shared/review-state";

describe("reviewTone", () => {
  it("maps the three known states", () => {
    expect(reviewTone("pending")).toBe("pending");
    expect(reviewTone("approved")).toBe("approved");
    expect(reviewTone("changes_requested")).toBe("changes");
  });
  it("keeps unknown states neutral — no whitelist to rot", () => {
    expect(reviewTone("dismissed")).toBe("neutral");
  });
});

describe("reviewLabel", () => {
  it("compresses changes_requested, passes everything else verbatim", () => {
    expect(reviewLabel("changes_requested")).toBe("changes");
    expect(reviewLabel("pending")).toBe("pending");
    expect(reviewLabel("dismissed")).toBe("dismissed");
  });
});
