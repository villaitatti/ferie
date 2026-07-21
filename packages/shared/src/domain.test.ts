import { describe, expect, it } from "vitest";
import { allocationsEqualDays, calculateVacationDays, holidaysForYear, validatePermissionInterval } from "./domain.js";

const schedule = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "09:00", end: "16:30" }));

describe("Italian holiday calendar", () => {
  it("includes Florence, Easter-relative closures, and October 4 from 2026", () => {
    const holidays = holidaysForYear(2026);
    expect(holidays).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2026-04-03", code: "VENERDI_SANTO" }),
      expect.objectContaining({ date: "2026-04-06", code: "PASQUETTA" }),
      expect.objectContaining({ date: "2026-06-24", code: "SAN_GIOVANNI" }),
      expect.objectContaining({ date: "2026-10-04", code: "SAN_FRANCESCO" }),
    ]));
    expect(holidaysForYear(2025).some((entry) => entry.code === "SAN_FRANCESCO")).toBe(false);
  });
});

describe("absence calculations", () => {
  it("deducts scheduled weekdays and excludes closures", () => {
    const result = calculateVacationDays("2026-06-22", "2026-06-26", schedule, new Set(["2026-06-24"]));
    expect(result.quantityDays).toBe(4);
    expect(result.excludedDates).toContainEqual({ date: "2026-06-24", reason: "HOLIDAY" });
  });

  it("validates allocations and permission intervals", () => {
    expect(allocationsEqualDays([{ amount: 3 }, { amount: 1 }], 4)).toBe(true);
    expect(validatePermissionInterval("2026-07-20", "09:30", "11:00", schedule)).toBe(90);
    expect(() => validatePermissionInterval("2026-07-20", "08:30", "09:30", schedule)).toThrow("OUTSIDE_WORK_SCHEDULE");
  });
});
