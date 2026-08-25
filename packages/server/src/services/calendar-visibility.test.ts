import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  employeeFindUnique: vi.fn(),
  requestFindMany: vi.fn(),
  assignmentFindMany: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    employeeMirror: { findUnique: mocks.employeeFindUnique },
    absenceRequest: { findMany: mocks.requestFindMany },
    approverAssignment: { findMany: mocks.assignmentFindMany },
  },
}));
vi.mock("./audit.js", () => ({ audit: vi.fn() }));
vi.mock("./queue.js", () => ({ enqueueNotification: vi.fn() }));

import { listCalendar } from "./portal.js";

const request = { actor: { subject: "auth0|viewer", roles: [] } } as unknown as Request;

function calendarEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    employeeId: "employee-1",
    employee: { displayName: "Angela Lees" },
    absenceType: { labelIt: "Malattia", labelEn: "Sick leave", departmentVisibility: "GENERIC", sensitivity: "SENSITIVE" },
    startDate: new Date("2026-09-07T00:00:00.000Z"),
    endDate: new Date("2026-09-08T00:00:00.000Z"),
    startTime: null,
    endTime: null,
    ...overrides,
  };
}

function viewer(overrides: Record<string, unknown> = {}) {
  return { id: "viewer-1", departmentId: "department-1", roles: [], department: { name: "Villa Management" }, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assignmentFindMany.mockResolvedValue([]);
});

describe("department calendar visibility (HR/CFO decision of 25 August 2026)", () => {
  it("shows colleagues a generic label for GENERIC types", async () => {
    mocks.employeeFindUnique.mockResolvedValue(viewer());
    mocks.requestFindMany.mockResolvedValue([calendarEntry()]);
    const result = await listCalendar(request, "department", "2026-09-01", "2026-09-30");
    expect(result).toHaveLength(1);
    expect(result[0]?.typeLabelIt).toBe("Assente");
    expect(result[0]?.typeLabelEn).toBe("Absent");
    // The flag is masked with the label: the calendar colours sensitive entries differently.
    expect(result[0]?.sensitive).toBe(false);
  });

  it("shows the exact type to the employee's responsabile", async () => {
    mocks.employeeFindUnique.mockResolvedValue(viewer());
    mocks.assignmentFindMany.mockResolvedValue([{ employeeId: "employee-1" }]);
    mocks.requestFindMany.mockResolvedValue([calendarEntry(), calendarEntry({ id: "request-2", employeeId: "employee-2", employee: { displayName: "Alessandro Superbi" } })]);
    const result = await listCalendar(request, "department", "2026-09-01", "2026-09-30");
    expect(result.find((entry) => entry.id === "request-1")?.typeLabelIt).toBe("Malattia");
    expect(result.find((entry) => entry.id === "request-1")?.sensitive).toBe(true);
    expect(result.find((entry) => entry.id === "request-2")?.typeLabelIt).toBe("Assente");
    expect(result.find((entry) => entry.id === "request-2")?.sensitive).toBe(false);
  });

  it("shows the exact type to HR without querying assignments", async () => {
    mocks.employeeFindUnique.mockResolvedValue(viewer({ roles: ["FERIE_FINAL_APPROVER"] }));
    mocks.requestFindMany.mockResolvedValue([calendarEntry()]);
    const result = await listCalendar(request, "department", "2026-09-01", "2026-09-30");
    expect(result[0]?.typeLabelEn).toBe("Sick leave");
    expect(mocks.assignmentFindMany).not.toHaveBeenCalled();
  });

  it("always shows employees their own entries exactly", async () => {
    mocks.employeeFindUnique.mockResolvedValue(viewer({ id: "employee-1" }));
    mocks.requestFindMany.mockResolvedValue([calendarEntry()]);
    const result = await listCalendar(request, "department", "2026-09-01", "2026-09-30");
    expect(result[0]?.typeLabelIt).toBe("Malattia");
  });

  it("excludes HIDDEN types from the department calendar for every viewer", async () => {
    mocks.employeeFindUnique.mockResolvedValue(viewer({ roles: ["FERIE_PORTAL_ADMIN"] }));
    mocks.requestFindMany.mockResolvedValue([calendarEntry({ absenceType: { labelIt: "Congedo", labelEn: "Leave", departmentVisibility: "HIDDEN", sensitivity: "SENSITIVE" } })]);
    const result = await listCalendar(request, "department", "2026-09-01", "2026-09-30");
    expect(result).toHaveLength(0);
  });
});
