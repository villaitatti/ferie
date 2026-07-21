import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  employeeFindUnique: vi.fn(),
  holidayFindMany: vi.fn(),
  segmentFindMany: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    employeeMirror: { findUnique: mocks.employeeFindUnique },
    holidayRule: { findMany: mocks.holidayFindMany },
    requestSegment: { findMany: mocks.segmentFindMany },
  },
}));

import { expandHolidayRules, listRequestCalendar } from "./portal.js";

const rule = {
  labelIt: "Festività",
  labelEn: "Holiday",
  kind: "NATIONAL" as const,
  month: null,
  day: null,
  easterOffset: null,
  oneOffDate: null,
  effectiveFrom: null,
  effectiveTo: null,
  active: true,
};

describe("request calendar metadata", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expands fixed, Easter-relative, and one-off rules within effective dates", () => {
    const occurrences = expandHolidayRules([
      { ...rule, code: "FIXED", recurrence: "FIXED_ANNUAL", month: 10, day: 4, effectiveFrom: new Date("2026-01-01T00:00:00Z") },
      { ...rule, code: "EASTER", recurrence: "EASTER_OFFSET", easterOffset: 1 },
      { ...rule, code: "ONE_OFF", recurrence: "ONE_OFF", oneOffDate: new Date("2026-07-22T00:00:00Z") },
      { ...rule, code: "INACTIVE", recurrence: "FIXED_ANNUAL", month: 7, day: 23, active: false },
      { ...rule, code: "EXPIRED", recurrence: "FIXED_ANNUAL", month: 7, day: 24, effectiveTo: new Date("2025-12-31T00:00:00Z") },
    ], "2026-01-01", "2026-12-31");

    expect(occurrences.map((entry) => [entry.code, entry.date])).toEqual([
      ["EASTER", "2026-04-06"],
      ["ONE_OFF", "2026-07-22"],
      ["FIXED", "2026-10-04"],
    ]);
  });

  it("scopes request segments to the authenticated employee and groups active states", async () => {
    mocks.employeeFindUnique.mockResolvedValue({ id: "employee-self", department: {}, roles: [] });
    mocks.holidayFindMany.mockResolvedValue([]);
    mocks.segmentFindMany.mockResolvedValue([
      {
        date: new Date("2026-08-03T00:00:00Z"),
        request: { id: "pending", status: "PENDING_APPROVAL", startTime: null, endTime: null, absenceType: { code: "FERIE", labelIt: "Ferie", labelEn: "Annual leave" } },
      },
      {
        date: new Date("2026-08-04T00:00:00Z"),
        request: { id: "approved", status: "CANCELLATION_REQUESTED", startTime: "09:00", endTime: "10:00", absenceType: { code: "PERMESSO", labelIt: "Permesso", labelEn: "Hourly leave" } },
      },
    ]);
    const request = { actor: { subject: "auth0|self" } } as Request;

    const result = await listRequestCalendar(request, { from: "2026-01-01", to: "2026-12-31" });

    expect(mocks.employeeFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { auth0Subject: "auth0|self" } }));
    expect(mocks.segmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        exclusionReason: null,
        request: expect.objectContaining({ employeeId: "employee-self" }),
      }),
    }));
    expect(result.days.map((day) => day.requests[0]?.state)).toEqual(["PENDING", "APPROVED"]);
  });
});
