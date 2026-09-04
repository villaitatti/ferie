import { type BalanceSummary, calculateBalanceAvailability } from "@ferie/shared";
import { prisma } from "../lib/prisma.js";
import { dbDate, isoDate } from "./portal.js";

function number(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

const APPROVED_STATUSES = ["APPROVED", "CHANGE_REQUESTED", "CANCELLATION_REQUESTED"];
const PENDING_STATUSES = ["PENDING_APPROVAL", "PENDING_FINAL_APPROVAL"];

export interface EmployeeBalancesRow {
  id: string;
  employeeNumber: string;
  displayName: string;
  title: string | null;
  departmentName: string;
  status: "ACTIVE" | "INACTIVE";
  balances: BalanceSummary[];
}

export interface EmployeeBalancesOverview {
  accounts: Array<{ code: string; labelIt: string; labelEn: string; unit: "DAYS" | "MINUTES" }>;
  employees: EmployeeBalancesRow[];
}

/**
 * The whole-roster counterpart of getBalanceSummaries, with identical per-account semantics: the
 * latest snapshot supplies the imported amount and the cutoff watermark, allocations and manual
 * adjustments count only past that watermark (or from today when no snapshot exists), and a
 * snapshot older than 45 days is stale. It cannot reuse getBalanceSummaries directly because that
 * issues ~1 + 3×accounts queries per employee; here five set-wide queries cover the entire roster
 * and the per-(employee, account) watermark is applied in memory.
 */
export async function listEmployeeBalances(): Promise<EmployeeBalancesOverview> {
  const now = Date.now();
  const today = dbDate(new Date(now).toISOString().slice(0, 10));
  const [accounts, employees, snapshots, allocations, adjustments] = await Promise.all([
    prisma.balanceAccount.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.employeeMirror.findMany({
      orderBy: { displayName: "asc" },
      select: { id: true, employeeNumber: true, displayName: true, title: true, status: true, department: { select: { name: true } } },
    }),
    prisma.balanceSnapshot.findMany({
      orderBy: [{ employeeId: "asc" }, { accountId: "asc" }, { asOf: "desc" }, { createdAt: "desc" }],
      distinct: ["employeeId", "accountId"],
      select: { employeeId: true, accountId: true, amount: true, asOf: true, cutoffDate: true },
    }),
    prisma.requestBalanceAllocation.findMany({
      where: { reversedAt: null, request: { status: { in: ["APPROVED", "CHANGE_REQUESTED", "CANCELLATION_REQUESTED", "PENDING_APPROVAL", "PENDING_FINAL_APPROVAL"] } } },
      select: { accountId: true, amount: true, request: { select: { employeeId: true, status: true, startDate: true } } },
    }),
    prisma.manualBalanceAdjustment.findMany({ select: { employeeId: true, accountId: true, amount: true, effectiveDate: true } }),
  ]);

  const snapshotByKey = new Map<string, (typeof snapshots)[number]>(snapshots.map((snapshot) => [`${snapshot.employeeId}:${snapshot.accountId}`, snapshot]));
  const allocationsByKey = new Map<string, typeof allocations>();
  for (const allocation of allocations) {
    const key = `${allocation.request.employeeId}:${allocation.accountId}`;
    allocationsByKey.set(key, [...(allocationsByKey.get(key) ?? []), allocation]);
  }
  const adjustmentsByKey = new Map<string, typeof adjustments>();
  for (const adjustment of adjustments) {
    const key = `${adjustment.employeeId}:${adjustment.accountId}`;
    adjustmentsByKey.set(key, [...(adjustmentsByKey.get(key) ?? []), adjustment]);
  }

  return {
    accounts: accounts.map((account) => ({ code: account.code, labelIt: account.labelIt, labelEn: account.labelEn, unit: account.unit })),
    employees: employees.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      displayName: employee.displayName,
      title: employee.title,
      departmentName: employee.department.name,
      status: employee.status,
      balances: accounts.map((account): BalanceSummary => {
        const key = `${employee.id}:${account.id}`;
        const snapshot = snapshotByKey.get(key);
        const inWindow = (date: Date) => (snapshot ? date.getTime() > snapshot.cutoffDate.getTime() : date.getTime() >= today.getTime());
        const counted = (allocationsByKey.get(key) ?? []).filter((allocation) => inWindow(allocation.request.startDate));
        const approvedFuture = counted.filter((allocation) => APPROVED_STATUSES.includes(allocation.request.status)).reduce((sum, allocation) => sum + number(allocation.amount), 0);
        const pending = counted.filter((allocation) => PENDING_STATUSES.includes(allocation.request.status)).reduce((sum, allocation) => sum + number(allocation.amount), 0);
        const adjusted = (adjustmentsByKey.get(key) ?? [])
          .filter((adjustment) => !snapshot || adjustment.effectiveDate.getTime() > snapshot.cutoffDate.getTime())
          .reduce((sum, adjustment) => sum + number(adjustment.amount), 0);
        const imported = snapshot ? number(snapshot.amount) : null;
        const availability = calculateBalanceAvailability(imported, adjusted, approvedFuture, pending);
        const age = snapshot ? Math.floor((now - snapshot.asOf.getTime()) / 86_400_000) : Infinity;
        return {
          code: account.code,
          labelIt: account.labelIt,
          labelEn: account.labelEn,
          unit: account.unit,
          imported,
          approvedFuture,
          pending,
          projected: availability.projected,
          available: availability.available,
          asOf: snapshot ? isoDate(snapshot.asOf) : null,
          stale: age > 45,
        };
      }),
    })),
  };
}
