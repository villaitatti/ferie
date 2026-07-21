import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actorFindUnique: vi.fn(),
  transaction: vi.fn(),
  audit: vi.fn(),
  executeRaw: vi.fn(),
  employeeFindMany: vi.fn(),
  typeFindMany: vi.fn(),
  reconciliationFindMany: vi.fn(),
  requestFindMany: vi.fn(),
  holidayFindMany: vi.fn(),
  accountFindMany: vi.fn(),
  requestCreate: vi.fn(),
}));

const tx = {
  $executeRaw: mocks.executeRaw,
  employeeMirror: { findMany: mocks.employeeFindMany },
  absenceType: { findMany: mocks.typeFindMany },
  reconciliationCase: { findMany: mocks.reconciliationFindMany, create: vi.fn() },
  absenceRequest: { findMany: mocks.requestFindMany, create: mocks.requestCreate },
  holidayRule: { findMany: mocks.holidayFindMany },
  balanceAccount: { findMany: mocks.accountFindMany, findUniqueOrThrow: vi.fn() },
  requestBalanceAllocation: { create: vi.fn() },
};

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    employeeMirror: { findUnique: mocks.actorFindUnique },
    $transaction: mocks.transaction,
  },
}));
vi.mock("./audit.js", () => ({ audit: mocks.audit }));
vi.mock("./queue.js", () => ({ enqueueNotification: vi.fn() }));

import { futureImportRowsOverlap, importFutureAbsences } from "./portal.js";

const request = { actor: { subject: "auth0|admin", roles: [] } } as unknown as Request;
const baseRow = {
  employeeNumber: "1001",
  absenceTypeCode: "FERIE" as const,
  startDate: "2026-08-03",
  endDate: "2026-08-03",
  allocations: [{ accountCode: "FERIE" as const, amount: 1 }],
};

describe("future absence imports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actorFindUnique.mockResolvedValue({ id: "admin", roles: ["FERIE_PORTAL_ADMIN"], department: {} });
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.employeeFindMany.mockResolvedValue([{
      id: "employee-1",
      employeeNumber: "1001",
      displayName: "Andrea Caselli",
      departmentId: "department-1",
      department: { name: "Research" },
      status: "ACTIVE",
      fte: 1,
      schedule: [{ weekday: 1, start: "09:00", end: "17:00" }],
    }]);
    mocks.typeFindMany.mockResolvedValue([{ id: "type-ferie", code: "FERIE", active: true }]);
    mocks.reconciliationFindMany.mockResolvedValue([]);
    mocks.requestFindMany.mockResolvedValue([]);
    mocks.holidayFindMany.mockResolvedValue([]);
    mocks.accountFindMany.mockResolvedValue([]);
  });

  it("writes no rows when any row in the batch is invalid", async () => {
    await expect(importFutureAbsences(request, {
      sourceName: "future-absence.csv",
      rows: [baseRow, { ...baseRow, employeeNumber: "9999", startDate: "2026-08-04", endDate: "2026-08-04" }],
    })).rejects.toMatchObject({
      status: 400,
      code: "IMPORT_HAS_ERRORS",
      details: { errors: [{ rowNumber: 2, code: "EMPLOYEE_NOT_FOUND" }] },
    });

    expect(mocks.requestCreate).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith(request, "FUTURE_ABSENCES_IMPORTED", "AbsenceImport", expect.any(String), expect.objectContaining({ created: 0 }));
  });

  it("detects overlapping rows inside the same import", () => {
    expect(futureImportRowsOverlap(baseRow, { ...baseRow, startDate: "2026-08-03", endDate: "2026-08-05" })).toBe(true);
    expect(futureImportRowsOverlap(baseRow, { ...baseRow, startDate: "2026-08-04", endDate: "2026-08-04" })).toBe(false);
    expect(futureImportRowsOverlap(
      { ...baseRow, absenceTypeCode: "PERMESSO", startTime: "09:00", endTime: "10:00", allocations: [] },
      { ...baseRow, absenceTypeCode: "PERMESSO", startTime: "09:30", endTime: "10:30", allocations: [] },
    )).toBe(true);
  });
});
