import type { RequestCalendarDay, WorkInterval } from "@ferie/shared";
import { describe, expect, it } from "vitest";
import { findRequestConflict, formatPortalDate, formatPortalDateRange, formatPortalDateTime, formatPortalDateWithWeekday, formatPortalList, isScheduledWorkday } from "./request-calendar";

const schedule: WorkInterval[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "09:00", end: "17:00" }));

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
});
