import { describe, expect, it } from "vitest";
import { holidayRuleUpsertSchema, requestCalendarRangeSchema } from "./schemas.js";

describe("request calendar range validation", () => {
  it("accepts a calendar year", () => {
    expect(requestCalendarRangeSchema.safeParse({ from: "2026-01-01", to: "2026-12-31" }).success).toBe(true);
  });

  it("rejects invalid and reversed calendar dates", () => {
    expect(requestCalendarRangeSchema.safeParse({ from: "2026-13-01", to: "2026-12-31" }).success).toBe(false);
    expect(requestCalendarRangeSchema.safeParse({ from: "2026-12-31", to: "2026-01-01" }).success).toBe(false);
  });
});

describe("holiday rule validation", () => {
  it("normalizes a valid custom one-off closure", () => {
    expect(holidayRuleUpsertSchema.parse({
      code: "  summer_closure ",
      labelIt: "  Chiusura estiva ",
      labelEn: "  Summer closure ",
      kind: "CUSTOM",
      recurrence: "ONE_OFF",
      oneOffDate: "2026-08-14",
      active: true,
    })).toEqual({
      code: "SUMMER_CLOSURE",
      labelIt: "Chiusura estiva",
      labelEn: "Summer closure",
      kind: "CUSTOM",
      recurrence: "ONE_OFF",
      oneOffDate: "2026-08-14",
      active: true,
    });
  });

  it("rejects empty labels, protected kinds, and inconsistent recurrence fields", () => {
    const base = { code: "TEST", labelIt: "Test", labelEn: "Test", kind: "CUSTOM", active: true };
    expect(holidayRuleUpsertSchema.safeParse({ ...base, labelIt: " ", recurrence: "ONE_OFF", oneOffDate: "2026-08-14" }).success).toBe(false);
    expect(holidayRuleUpsertSchema.safeParse({ ...base, kind: "NATIONAL", recurrence: "ONE_OFF", oneOffDate: "2026-08-14" }).success).toBe(false);
    expect(holidayRuleUpsertSchema.safeParse({ ...base, recurrence: "FIXED_ANNUAL", month: 2, day: 30 }).success).toBe(false);
    expect(holidayRuleUpsertSchema.safeParse({ ...base, recurrence: "ONE_OFF", oneOffDate: "2026-08-14", month: 8, day: 14 }).success).toBe(false);
  });
});
