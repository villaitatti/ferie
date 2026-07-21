import { describe, expect, it } from "vitest";
import { requestCalendarRangeSchema } from "./schemas.js";

describe("request calendar range validation", () => {
  it("accepts a calendar year", () => {
    expect(requestCalendarRangeSchema.safeParse({ from: "2026-01-01", to: "2026-12-31" }).success).toBe(true);
  });

  it("rejects invalid and reversed calendar dates", () => {
    expect(requestCalendarRangeSchema.safeParse({ from: "2026-13-01", to: "2026-12-31" }).success).toBe(false);
    expect(requestCalendarRangeSchema.safeParse({ from: "2026-12-31", to: "2026-01-01" }).success).toBe(false);
  });
});
