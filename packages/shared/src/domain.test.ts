import { describe, expect, it } from "vitest";
import { allocationsEqualDays, calculateBalanceAvailability, calculateVacationDays, holidaysForYear, validatePermissionInterval } from "./domain.js";

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
  it("reserves pending requests without changing the approved-only projection", () => {
    expect(calculateBalanceAvailability(5, 0, 0, 5)).toEqual({ projected: 5, available: 0 });
    expect(calculateBalanceAvailability(5, 1, 2, 3)).toEqual({ projected: 4, available: 1 });
    expect(calculateBalanceAvailability(null, 0, 0, 5)).toEqual({ projected: null, available: null });
  });

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

  it("deducts only scheduled minutes when a permission crosses an unpaid break", () => {
    const splitSchedule = [
      { weekday: 1, start: "09:00", end: "13:00" },
      { weekday: 1, start: "13:30", end: "17:00" },
    ];
    expect(validatePermissionInterval("2026-07-20", "12:00", "14:00", splitSchedule)).toBe(90);
    expect(() => validatePermissionInterval("2026-07-20", "13:10", "14:00", splitSchedule)).toThrow("OUTSIDE_WORK_SCHEDULE");
  });
});
