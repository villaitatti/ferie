import type { RequestCalendarDay, WorkInterval } from "@ferie/shared";
import { describe, expect, it } from "vitest";
import { findRequestConflict, formatPortalDate, formatPortalDateRange, formatPortalDateTime, formatPortalDateWithWeekday, formatPortalList, isScheduledWorkday, permissionEndSlots, permissionStartSlots } from "./request-calendar";

const schedule: WorkInterval[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "09:00", end: "17:00" }));
const splitSchedule: WorkInterval[] = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, start: "09:00", end: "13:00" },
  { weekday, start: "13:30", end: "17:00" },
]);

const days: RequestCalendarDay[] = [
  {
    date: "2026-07-20",
    holidays: [],
    requests: [{ requestId: "approved", state: "APPROVED", absenceTypeCode: "FERIE", labelIt: "Ferie", labelEn: "Annual leave", startTime: null, endTime: null }],
  },
  {
    date: "2026-07-22",
    holidays: [],
    requests: [{ requestId: "pending", state: "PENDING", absenceTypeCode: "PERMESSO", labelIt: "Permesso", labelEn: "Hourly leave", startTime: "09:00", endTime: "10:00" }],
  },
];

describe("request calendar selection helpers", () => {
  it("formats date-only values with translated month names", () => {
    expect(formatPortalDate("2026-03-01", "en")).toBe("01 March 2026");
    expect(formatPortalDate("2026-03-01", "it")).toBe("01 marzo 2026");
    expect(formatPortalDateTime("2026-03-02T13:45:00Z", "en")).toBe("02 March 2026 at 14:45");
  });

  it("collapses a one-day range to a single localized date", () => {
    expect(formatPortalDateRange("2026-08-07", "2026-08-07", "it")).toBe("07 agosto 2026");
    expect(formatPortalDateRange("2026-08-07", "2026-08-10", "en")).toBe("07 August 2026 – 10 August 2026");
  });

  it("formats excluded dates with localized weekdays and conjunctions", () => {
    const dates = [
      formatPortalDateWithWeekday("2026-07-11", "it"),
      formatPortalDateWithWeekday("2026-07-12", "it"),
    ];
    expect(formatPortalList(dates, "it")).toBe("sabato 11 luglio 2026 e domenica 12 luglio 2026");
    expect(formatPortalDateWithWeekday("2026-12-25", "en")).toBe("Friday, 25 December 2026");
  });

  it("uses the ED schedule to distinguish working and non-working dates", () => {
    expect(isScheduledWorkday("2026-07-20", schedule)).toBe(true);
    expect(isScheduledWorkday("2026-07-18", schedule)).toBe(false);
  });

  it("finds approved and pending conflicts across a selected range", () => {
    expect(findRequestConflict(days, "2026-07-19", "2026-07-21")?.request.requestId).toBe("approved");
    expect(findRequestConflict(days, "2026-07-21", "2026-07-23")?.request.requestId).toBe("pending");
  });

  it("ignores the approved request currently being revised", () => {
    expect(findRequestConflict(days, "2026-07-19", "2026-07-21", "approved")).toBeNull();
  });

  it("allows ranges that only cross non-working days", () => {
    expect(findRequestConflict(days, "2026-07-24", "2026-07-27")).toBeNull();
  });

  it("builds half-hour permission slots from the work schedule", () => {
    expect(permissionStartSlots("2026-07-20", schedule).slice(0, 3)).toEqual(["09:00", "09:30", "10:00"]);
    expect(permissionStartSlots("2026-07-20", schedule).at(-1)).toBe("16:30");
    expect(permissionEndSlots("2026-07-20", schedule, "16:00")).toEqual(["16:30", "17:00"]);
    expect(permissionStartSlots("2026-07-20", splitSchedule)).toContain("12:30");
    expect(permissionStartSlots("2026-07-20", splitSchedule)).toContain("13:30");
    expect(permissionStartSlots("2026-07-20", splitSchedule)).not.toContain("13:00");
    expect(permissionEndSlots("2026-07-20", splitSchedule, "12:00")).toEqual([
      "12:30", "13:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
    ]);
  });

  it("includes early starts such as 07:30 from the employee's ED schedule", () => {
    const earlySchedule: WorkInterval[] = [1, 2, 3, 4, 5].flatMap((weekday) => [
      { weekday, start: "07:30", end: "12:00" },
      { weekday, start: "12:30", end: "15:30" },
    ]);
    expect(permissionStartSlots("2026-07-20", earlySchedule).slice(0, 3)).toEqual(["07:30", "08:00", "08:30"]);
    expect(permissionEndSlots("2026-07-20", earlySchedule, "07:30")).toEqual([
      "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
      "13:00", "13:30", "14:00", "14:30", "15:00",
    ]);
    expect(permissionEndSlots("2026-07-20", earlySchedule, "07:30")).not.toContain("15:30");
    expect(permissionStartSlots("2026-07-20", earlySchedule)).not.toContain("07:00");
  });

  it("does not offer a full-day permesso end time on a 7.5h schedule", () => {
    expect(permissionEndSlots("2026-07-20", splitSchedule, "09:00")).not.toContain("17:00");
    expect(permissionEndSlots("2026-07-20", splitSchedule, "09:00")).toContain("16:30");
  });
});
