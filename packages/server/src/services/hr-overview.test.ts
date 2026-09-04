import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountFindMany: vi.fn(),
  employeeFindMany: vi.fn(),
  snapshotFindMany: vi.fn(),
  allocationFindMany: vi.fn(),
  adjustmentFindMany: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    balanceAccount: { findMany: mocks.accountFindMany },
    employeeMirror: { findMany: mocks.employeeFindMany },
    balanceSnapshot: { findMany: mocks.snapshotFindMany },
    requestBalanceAllocation: { findMany: mocks.allocationFindMany },
    manualBalanceAdjustment: { findMany: mocks.adjustmentFindMany },
  },
}));
vi.mock("./audit.js", () => ({ audit: vi.fn() }));
vi.mock("./queue.js", () => ({ enqueueNotification: vi.fn() }));

import { listEmployeeBalances } from "./hr-overview.js";

const DAY = 86_400_000;
const ferie = { id: "acc-ferie", code: "FERIE", labelIt: "Ferie", labelEn: "Annual leave", unit: "DAYS" };

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY);
}

describe("HR employee balances overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountFindMany.mockResolvedValue([ferie]);
    mocks.employeeFindMany.mockResolvedValue([
      { id: "emp-a", employeeNumber: "1001", displayName: "Anna Verdi", title: "Archivist", status: "ACTIVE", department: { name: "Research" } },
      { id: "emp-b", employeeNumber: "1002", displayName: "Bruno Neri", title: null, status: "INACTIVE", department: { name: "Finance" } },
    ]);
    mocks.snapshotFindMany.mockResolvedValue([]);
    mocks.allocationFindMany.mockResolvedValue([]);
    mocks.adjustmentFindMany.mockResolvedValue([]);
  });

  it("applies the snapshot watermark: only allocations and adjustments past the cutoff count", async () => {
    const cutoff = daysFromNow(-30);
    mocks.snapshotFindMany.mockResolvedValue([
      { employeeId: "emp-a", accountId: "acc-ferie", amount: 20, asOf: daysFromNow(-10), cutoffDate: cutoff },
    ]);
    mocks.allocationFindMany.mockResolvedValue([
      { accountId: "acc-ferie", amount: 5, request: { employeeId: "emp-a", status: "APPROVED", startDate: daysFromNow(10) } },
      { accountId: "acc-ferie", amount: 2, request: { employeeId: "emp-a", status: "PENDING_APPROVAL", startDate: daysFromNow(20) } },
      // Before the cutoff: already inside the imported amount, must not be double counted.
      { accountId: "acc-ferie", amount: 9, request: { employeeId: "emp-a", status: "APPROVED", startDate: daysFromNow(-40) } },
    ]);
    mocks.adjustmentFindMany.mockResolvedValue([
      { employeeId: "emp-a", accountId: "acc-ferie", amount: 1, effectiveDate: daysFromNow(-5) },
      { employeeId: "emp-a", accountId: "acc-ferie", amount: 4, effectiveDate: daysFromNow(-40) },
    ]);

    const overview = await listEmployeeBalances();
    const balance = overview.employees[0]?.balances[0];
    expect(overview.employees[0]?.displayName).toBe("Anna Verdi");
    // projected = 20 imported + 1 adjustment - 5 approved; available = projected - 2 pending.
    expect(balance).toMatchObject({ code: "FERIE", imported: 20, approvedFuture: 5, pending: 2, projected: 16, available: 14, stale: false });
  });

  it("treats an employee without a snapshot as having no balance, counting from today", async () => {
    mocks.allocationFindMany.mockResolvedValue([
      { accountId: "acc-ferie", amount: 3, request: { employeeId: "emp-b", status: "PENDING_APPROVAL", startDate: daysFromNow(5) } },
      { accountId: "acc-ferie", amount: 6, request: { employeeId: "emp-b", status: "APPROVED", startDate: daysFromNow(-5) } },
    ]);

    const overview = await listEmployeeBalances();
    const balance = overview.employees[1]?.balances[0];
    expect(balance).toMatchObject({ imported: null, projected: null, available: null, pending: 3, approvedFuture: 0, asOf: null, stale: true });
  });

  it("marks a snapshot older than 45 days as stale and lists the active accounts", async () => {
    mocks.snapshotFindMany.mockResolvedValue([
      { employeeId: "emp-a", accountId: "acc-ferie", amount: 10, asOf: daysFromNow(-60), cutoffDate: daysFromNow(-60) },
    ]);

    const overview = await listEmployeeBalances();
    expect(overview.accounts).toEqual([{ code: "FERIE", labelIt: "Ferie", labelEn: "Annual leave", unit: "DAYS" }]);
    expect(overview.employees[0]?.balances[0]).toMatchObject({ imported: 10, stale: true });
    expect(overview.employees[1]?.status).toBe("INACTIVE");
  });
});
