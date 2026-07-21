import { createHash } from "node:crypto";
import type { Request } from "express";
import type { HolidayRule, Prisma } from "@prisma/client";
import {
  allocationsEqualDays,
  balanceAdjustmentSchema,
  balanceImportSchema,
  calculateVacationDays,
  decisionSchema,
  easterSunday,
  futureAbsenceImportSchema,
  requestPreviewSchema,
  requestCalendarRangeSchema,
  resolveDecisionTransition,
  sensitiveAbsenceSchema,
  submitRequestSchema,
  validatePermissionInterval,
  type BalanceSummary,
  type RequestListItem,
  type RequestCalendarDay,
  type RequestCalendarHoliday,
  type RequestPreviewInput,
  type WorkInterval,
} from "@ferie/shared";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";
import { audit } from "./audit.js";
import { enqueueNotification } from "./queue.js";

const activeStatuses = ["PENDING_APPROVAL", "PENDING_FINAL_APPROVAL", "APPROVED", "CHANGE_REQUESTED", "CANCELLATION_REQUESTED"] as const;

export function dbDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function number(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

async function actorEmployee(request: Request) {
  const employee = await prisma.employeeMirror.findUnique({
    where: { auth0Subject: request.actor.subject },
    include: { department: true },
  });
  if (!employee) throw new HttpError(403, "DIRECTORY_IDENTITY_NOT_FOUND");
  return employee;
}

export async function assertCurrentRole(request: Request, allowed: string[]) {
  const actor = await actorEmployee(request);
  if (!allowed.some((role) => actor.roles.includes(role as never))) throw new HttpError(403, "CURRENT_DIRECTORY_ROLE_REQUIRED");
  return actor;
}

function currentRoles(employee: { roles: string[] }): string[] {
  return employee.roles;
}

export async function getMe(request: Request) {
  const employee = await actorEmployee(request);
  const balances = await getBalanceSummaries(employee.id);
  const pendingApprovals = await countPendingApprovals(employee.id, currentRoles(employee));
  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      displayName: employee.displayName,
      email: employee.email,
      title: employee.title,
      departmentId: employee.departmentId,
      departmentName: employee.department.name,
      fte: number(employee.fte),
      status: employee.status,
      schedule: employee.schedule,
      roles: employee.roles,
    },
    balances,
    capabilities: {
      canApprove: pendingApprovals > 0 || await prisma.approverAssignment.count({ where: { approverId: employee.id } }) > 0,
      canFinalApprove: employee.roles.includes("FERIE_FINAL_APPROVER"),
      canAdminister: employee.roles.includes("FERIE_PORTAL_ADMIN"),
      canInspectIntegrations: employee.roles.includes("STAFF_IT") || employee.roles.includes("FERIE_PORTAL_ADMIN"),
    },
    pendingApprovals,
  };
}

async function countPendingApprovals(employeeId: string, roles: string[]): Promise<number> {
  const subjects = await prisma.approverAssignment.findMany({ where: { approverId: employeeId }, select: { employeeId: true } });
  return prisma.absenceRequest.count({
    where: {
      OR: [
        { status: { in: ["PENDING_APPROVAL", "CANCELLATION_REQUESTED"] }, employeeId: { in: subjects.map((entry) => entry.employeeId) } },
        ...(roles.includes("FERIE_FINAL_APPROVER") ? [{ status: "PENDING_FINAL_APPROVAL" as const }] : []),
      ],
    },
  });
}

export async function getBalanceSummaries(employeeId: string): Promise<BalanceSummary[]> {
  const accounts = await prisma.balanceAccount.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  return Promise.all(accounts.map(async (account) => {
    const snapshot = await prisma.balanceSnapshot.findFirst({
      where: { employeeId, accountId: account.id },
      orderBy: [{ asOf: "desc" }, { createdAt: "desc" }],
    });
    const futureWhere = snapshot ? { gt: snapshot.cutoffDate } : { gte: dbDate(new Date().toISOString().slice(0, 10)) };
    const [allocations, adjustmentAggregate] = await Promise.all([prisma.requestBalanceAllocation.findMany({
      where: {
        accountId: account.id,
        reversedAt: null,
        request: { employeeId, startDate: futureWhere },
      },
      include: { request: { select: { status: true } } },
    }), prisma.manualBalanceAdjustment.aggregate({
      where: { employeeId, accountId: account.id, ...(snapshot ? { effectiveDate: { gt: snapshot.cutoffDate } } : {}) },
      _sum: { amount: true },
    })]);
    const approvedFuture = allocations.filter((entry) => ["APPROVED", "CHANGE_REQUESTED", "CANCELLATION_REQUESTED"].includes(entry.request.status)).reduce((sum, entry) => sum + number(entry.amount), 0);
    const pending = allocations.filter((entry) => entry.request.status === "PENDING_APPROVAL" || entry.request.status === "PENDING_FINAL_APPROVAL").reduce((sum, entry) => sum + number(entry.amount), 0);
    const imported = snapshot ? number(snapshot.amount) : null;
    const adjustments = adjustmentAggregate._sum.amount ? number(adjustmentAggregate._sum.amount) : 0;
    const age = snapshot ? Math.floor((Date.now() - snapshot.asOf.getTime()) / 86_400_000) : Infinity;
    return {
      code: account.code,
      labelIt: account.labelIt,
      labelEn: account.labelEn,
      unit: account.unit,
      imported,
      approvedFuture,
      pending,
      projected: imported === null ? null : imported + adjustments - approvedFuture,
      asOf: snapshot ? isoDate(snapshot.asOf) : null,
      stale: age > 45,
    };
  }));
}

async function effectiveHolidayOccurrences(startDate: string, endDate: string) {
  const rules = await prisma.holidayRule.findMany({ where: { active: true } });
  return expandHolidayRules(rules, startDate, endDate);
}

async function effectiveHolidayDates(startDate: string, endDate: string): Promise<Set<string>> {
  return new Set((await effectiveHolidayOccurrences(startDate, endDate)).map((entry) => entry.date));
}

type EffectiveHolidayRule = Pick<HolidayRule, "code" | "labelIt" | "labelEn" | "kind" | "recurrence" | "month" | "day" | "easterOffset" | "oneOffDate" | "effectiveFrom" | "effectiveTo" | "active">;

export function expandHolidayRules(rules: EffectiveHolidayRule[], startDate: string, endDate: string): Array<RequestCalendarHoliday & { date: string }> {
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  const occurrences: Array<RequestCalendarHoliday & { date: string }> = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    if (rule.recurrence === "ONE_OFF" && rule.oneOffDate) {
      const value = isoDate(rule.oneOffDate);
      if (value >= startDate && value <= endDate) occurrences.push({ date: value, code: rule.code, kind: rule.kind, labelIt: rule.labelIt, labelEn: rule.labelEn });
      continue;
    }
    for (let year = startYear; year <= endYear; year += 1) {
      let value: string | null = null;
      if (rule.recurrence === "FIXED_ANNUAL" && rule.month && rule.day) value = `${year}-${String(rule.month).padStart(2, "0")}-${String(rule.day).padStart(2, "0")}`;
      if (rule.recurrence === "EASTER_OFFSET" && rule.easterOffset !== null) value = easterSunday(year).add({ days: rule.easterOffset }).toString();
      if (!value || value < startDate || value > endDate) continue;
      const effectiveFrom = rule.effectiveFrom ? isoDate(rule.effectiveFrom) : null;
      const effectiveTo = rule.effectiveTo ? isoDate(rule.effectiveTo) : null;
      if ((!effectiveFrom || value >= effectiveFrom) && (!effectiveTo || value <= effectiveTo)) {
        occurrences.push({ date: value, code: rule.code, kind: rule.kind, labelIt: rule.labelIt, labelEn: rule.labelEn });
      }
    }
  }
  return occurrences.sort((left, right) => left.date.localeCompare(right.date) || left.code.localeCompare(right.code));
}

export async function listRequestCalendar(request: Request, raw: unknown) {
  const { from, to } = requestCalendarRangeSchema.parse(raw);
  const actor = await actorEmployee(request);
  const [rules, segments] = await Promise.all([
    prisma.holidayRule.findMany({ where: { active: true } }),
    prisma.requestSegment.findMany({
      where: {
        date: { gte: dbDate(from), lte: dbDate(to) },
        exclusionReason: null,
        request: { employeeId: actor.id, status: { in: [...activeStatuses] } },
      },
      include: { request: { include: { absenceType: true } } },
      orderBy: { date: "asc" },
    }),
  ]);
  const days = new Map<string, RequestCalendarDay>();
  const getDay = (date: string) => {
    const existing = days.get(date);
    if (existing) return existing;
    const day: RequestCalendarDay = { date, holidays: [], requests: [] };
    days.set(date, day);
    return day;
  };
  for (const holiday of expandHolidayRules(rules, from, to)) {
    const { date, ...metadata } = holiday;
    getDay(date).holidays.push(metadata);
  }
  for (const segment of segments) {
    const entry = segment.request;
    getDay(isoDate(segment.date)).requests.push({
      requestId: entry.id,
      state: entry.status === "PENDING_APPROVAL" || entry.status === "PENDING_FINAL_APPROVAL" ? "PENDING" : "APPROVED",
      absenceTypeCode: entry.absenceType.code,
      labelIt: entry.absenceType.labelIt,
      labelEn: entry.absenceType.labelEn,
      startTime: entry.startTime,
      endTime: entry.endTime,
    });
  }
  return { from, to, days: [...days.values()].sort((left, right) => left.date.localeCompare(right.date)) };
}

async function findEmployeeForInput(request: Request, employeeId?: string) {
  const actor = await actorEmployee(request);
  if (!employeeId || employeeId === actor.id) return actor;
  if (!actor.roles.includes("FERIE_PORTAL_ADMIN")) throw new HttpError(403, "ADMIN_REQUIRED");
  const target = await prisma.employeeMirror.findUnique({ where: { id: employeeId }, include: { department: true } });
  if (!target) throw new HttpError(404, "EMPLOYEE_NOT_FOUND");
  return target;
}

async function checkOverlap(employeeId: string, input: RequestPreviewInput, excludeRequestId?: string) {
  const candidates = await prisma.absenceRequest.findMany({
    where: {
      employeeId,
      id: excludeRequestId ? { not: excludeRequestId } : undefined,
      status: { in: [...activeStatuses] },
      startDate: { lte: dbDate(input.endDate) },
      endDate: { gte: dbDate(input.startDate) },
    },
  });
  if (input.absenceTypeCode !== "PERMESSO") {
    if (candidates.length > 0) throw new HttpError(409, "OVERLAPPING_REQUEST");
    return;
  }
  const start = input.startTime;
  const end = input.endTime;
  const overlaps = candidates.some((entry) => {
    if (isoDate(entry.startDate) !== input.startDate) return true;
    if (!entry.startTime || !entry.endTime) return true;
    return start < entry.endTime && end > entry.startTime;
  });
  if (overlaps) throw new HttpError(409, "OVERLAPPING_REQUEST");
}

export async function previewRequest(request: Request, raw: unknown) {
  const input = requestPreviewSchema.parse(raw);
  const employee = await findEmployeeForInput(request, input.employeeId);
  if (employee.status !== "ACTIVE") throw new HttpError(409, "EMPLOYEE_INACTIVE");
  const excludeRequestId = typeof raw === "object" && raw !== null && "revisionOfId" in raw && typeof raw.revisionOfId === "string" ? raw.revisionOfId : undefined;
  await checkOverlap(employee.id, input, excludeRequestId);
  const schedule = employee.schedule as unknown as WorkInterval[];
  let quantity: number;
  let unit: "DAYS" | "MINUTES";
  let segments: Array<{ date: string; quantity: number; exclusionReason?: string; holidays?: RequestCalendarHoliday[] }>;
  let allocations: Array<{ accountCode: string; amount: number }>;

  if (input.absenceTypeCode === "PERMESSO") {
    if (input.startDate !== input.endDate) throw new HttpError(400, "PERMISSION_MUST_BE_ONE_DAY");
    const holidays = await effectiveHolidayDates(input.startDate, input.endDate);
    if (holidays.has(input.startDate)) throw new HttpError(400, "NON_WORKING_DAY");
    try { quantity = validatePermissionInterval(input.startDate, input.startTime, input.endTime, schedule); }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : "INVALID_TIME_INTERVAL"); }
    unit = "MINUTES";
    segments = [{ date: input.startDate, quantity }];
    allocations = [{ accountCode: "PERMESSO", amount: quantity }];
  } else {
    const holidayOccurrences = await effectiveHolidayOccurrences(input.startDate, input.endDate);
    const holidays = new Set(holidayOccurrences.map((entry) => entry.date));
    const holidaysByDate = new Map<string, RequestCalendarHoliday[]>();
    for (const { date, ...holiday } of holidayOccurrences) {
      holidaysByDate.set(date, [...(holidaysByDate.get(date) ?? []), holiday]);
    }
    let calculation;
    try { calculation = calculateVacationDays(input.startDate, input.endDate, schedule, holidays); }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : "INVALID_DATE_RANGE"); }
    if (calculation.quantityDays === 0) throw new HttpError(400, "NO_WORKING_DAYS");
    quantity = calculation.quantityDays;
    unit = "DAYS";
    segments = [
      ...calculation.deductibleDates.map((date) => ({ date, quantity: 1 })),
      ...calculation.excludedDates.map((entry) => ({
        date: entry.date,
        quantity: 0,
        exclusionReason: entry.reason,
        holidays: holidaysByDate.get(entry.date),
      })),
    ];
    allocations = input.absenceTypeCode === "FERIE" ? input.allocations : [];
    if (input.absenceTypeCode === "FERIE" && allocations.length > 0 && !allocationsEqualDays(allocations, quantity)) {
      throw new HttpError(400, "ALLOCATIONS_MUST_EQUAL_DEDUCTIBLE_DAYS");
    }
  }

  const balances = await getBalanceSummaries(employee.id);
  const replacementCredits = new Map<string, number>();
  if (excludeRequestId) {
    const replaced = await prisma.requestBalanceAllocation.findMany({ where: { requestId: excludeRequestId, reversedAt: null }, include: { account: true } });
    replaced.forEach((allocation) => replacementCredits.set(allocation.account.code, number(allocation.amount)));
  }
  const overBalance = allocations.some((allocation) => {
    const balance = balances.find((entry) => entry.code === allocation.accountCode);
    return balance?.projected !== null && balance?.projected !== undefined && balance.projected + (replacementCredits.get(allocation.accountCode) ?? 0) - allocation.amount < 0;
  });
  return { input, employeeId: employee.id, quantity, unit, segments, allocations, balances, overBalance };
}

async function approverRecipients(employeeId: string): Promise<string[]> {
  const assignments = await prisma.approverAssignment.findMany({
    where: { employeeId },
    include: { approver: { select: { email: true } } },
  });
  const preApprovers = assignments.filter((entry) => entry.role === "PRE_APPROVER");
  const recipients = preApprovers.length > 0 ? preApprovers : assignments.filter((entry) => entry.role === "RESPONSABILE");
  return [...new Set(recipients.map((entry) => entry.approver.email))];
}

export async function submitRequest(request: Request, raw: unknown) {
  const input = submitRequestSchema.parse(raw);
  const preview = await previewRequest(request, input);
  if (input.absenceTypeCode === "FERIE" && preview.allocations.length === 0) throw new HttpError(400, "BALANCE_ALLOCATION_REQUIRED");
  const employee = await prisma.employeeMirror.findUniqueOrThrow({ where: { id: preview.employeeId }, include: { department: true } });
  const absenceType = await prisma.absenceType.findUnique({ where: { code: input.absenceTypeCode } });
  if (!absenceType || !absenceType.active) throw new HttpError(400, "ABSENCE_TYPE_DISABLED");
  if (absenceType.entryMode === "ADMIN_ONLY") throw new HttpError(403, "ADMIN_ENTRY_REQUIRED");
  const parent = input.revisionOfId ? await getRequest(input.revisionOfId) : null;
  if (parent && (parent.employeeId !== employee.id || parent.status !== "APPROVED")) throw new HttpError(409, "REVISION_SOURCE_NOT_APPROVED");

  const created = await prisma.$transaction(async (tx) => {
    if (parent) {
      const changed = await tx.absenceRequest.updateMany({ where: { id: parent.id, status: "APPROVED" }, data: { status: "CHANGE_REQUESTED" } });
      if (changed.count !== 1) throw new HttpError(409, "REQUEST_STATUS_CHANGED");
    }
    const result = await tx.absenceRequest.create({
      data: {
        employeeId: employee.id,
        absenceTypeId: absenceType.id,
        startDate: dbDate(input.startDate),
        endDate: dbDate(input.endDate),
        startTime: input.absenceTypeCode === "PERMESSO" ? input.startTime : null,
        endTime: input.absenceTypeCode === "PERMESSO" ? input.endTime : null,
        quantity: preview.quantity,
        unit: preview.unit,
        status: "PENDING_APPROVAL",
        provenance: "SELF_SERVICE",
        overBalance: preview.overBalance,
        parentRequestId: input.revisionOfId,
        submittedAt: new Date(),
        employeeSnapshot: {
          employeeNumber: employee.employeeNumber,
          displayName: employee.displayName,
          departmentId: employee.departmentId,
          departmentName: employee.department.name,
          fte: number(employee.fte),
          schedule: employee.schedule,
        },
        calculationSnapshot: {
          segments: preview.segments.map((segment) => ({ date: segment.date, quantity: segment.quantity, exclusionReason: segment.exclusionReason })),
          allocations: preview.allocations,
        },
        segments: { create: preview.segments.map((segment) => ({ date: dbDate(segment.date), quantity: segment.quantity, unit: preview.unit, exclusionReason: segment.exclusionReason })) },
        decisions: { create: { actorSubject: request.actor.subject, actorName: employee.displayName, action: "SUBMIT", toStatus: "PENDING_APPROVAL" } },
      },
    });
    for (const allocation of preview.allocations) {
      const account = await tx.balanceAccount.findUniqueOrThrow({ where: { code: allocation.accountCode } });
      await tx.requestBalanceAllocation.create({ data: { requestId: result.id, accountId: account.id, amount: allocation.amount } });
    }
    return result;
  });
  await audit(request, "REQUEST_SUBMITTED", "AbsenceRequest", created.id, { status: created.status, overBalance: created.overBalance });
  for (const recipient of await approverRecipients(employee.id)) await enqueueNotification(created.id, recipient, "APPROVAL_REQUIRED");
  return serializeRequest(await getRequest(created.id));
}

async function getRequest(id: string) {
  const result = await prisma.absenceRequest.findUnique({
    where: { id },
    include: { employee: { include: { department: true } }, absenceType: true, allocations: { include: { account: true } }, segments: true, decisions: { orderBy: { createdAt: "asc" } } },
  });
  if (!result) throw new HttpError(404, "REQUEST_NOT_FOUND");
  return result;
}

function serializeRequest(entry: Awaited<ReturnType<typeof getRequest>>): RequestListItem & Record<string, unknown> {
  return {
    id: entry.id,
    employeeId: entry.employeeId,
    employeeName: entry.employee.displayName,
    departmentId: entry.employee.departmentId,
    departmentName: entry.employee.department.name,
    absenceTypeCode: entry.absenceType.code,
    absenceTypeLabelIt: entry.absenceType.labelIt,
    absenceTypeLabelEn: entry.absenceType.labelEn,
    startDate: isoDate(entry.startDate),
    endDate: isoDate(entry.endDate),
    startTime: entry.startTime,
    endTime: entry.endTime,
    quantity: number(entry.quantity),
    unit: entry.unit,
    status: entry.status,
    provenance: entry.provenance,
    overBalance: entry.overBalance,
    submittedAt: entry.submittedAt?.toISOString() ?? null,
    allocations: entry.allocations.map((allocation) => ({ accountCode: allocation.account.code, amount: number(allocation.amount) })),
    decisions: entry.decisions,
  };
}

export async function listMyRequests(request: Request) {
  const employee = await actorEmployee(request);
  const entries = await prisma.absenceRequest.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: "desc" }, select: { id: true } });
  return Promise.all(entries.map(async (entry) => serializeRequest(await getRequest(entry.id))));
}

export async function listApprovals(request: Request) {
  const actor = await actorEmployee(request);
  const assignments = await prisma.approverAssignment.findMany({ where: { approverId: actor.id }, select: { employeeId: true } });
  const entries = await prisma.absenceRequest.findMany({
    where: {
      OR: [
        { status: { in: ["PENDING_APPROVAL", "CANCELLATION_REQUESTED"] }, employeeId: { in: assignments.map((entry) => entry.employeeId) } },
        ...(actor.roles.includes("FERIE_FINAL_APPROVER") ? [{ status: "PENDING_FINAL_APPROVAL" as const }] : []),
      ],
    },
    orderBy: { submittedAt: "asc" },
    select: { id: true },
  });
  return Promise.all(entries.map(async (entry) => serializeRequest(await getRequest(entry.id))));
}

export async function decideRequest(request: Request, id: string, raw: unknown) {
  const input = decisionSchema.parse(raw);
  const actor = await actorEmployee(request);
  const existing = await getRequest(id);
  if (existing.status !== input.expectedStatus) throw new HttpError(409, "REQUEST_STATUS_CHANGED");
  const finalStage = existing.status === "PENDING_FINAL_APPROVAL";
  if (finalStage && !actor.roles.includes("FERIE_FINAL_APPROVER")) throw new HttpError(403, "FINAL_APPROVER_REQUIRED");
  if (!finalStage) {
    const assigned = await prisma.approverAssignment.count({ where: { employeeId: existing.employeeId, approverId: actor.id } });
    if (assigned === 0) throw new HttpError(403, "CURRENT_APPROVER_REQUIRED");
  }
  const cancellation = existing.status === "CANCELLATION_REQUESTED";
  const exceedsNow = !cancellation && await requestWouldExceedBalance(existing.id);
  if (exceedsNow && !existing.overBalance) await prisma.absenceRequest.update({ where: { id }, data: { overBalance: true } });
  let toStatus;
  try {
    toStatus = resolveDecisionTransition({ status: existing.status, action: input.action, overBalance: existing.overBalance || exceedsNow, isFinalApprover: actor.roles.includes("FERIE_FINAL_APPROVER") });
  } catch (error) {
    const code = error instanceof Error ? error.message : "DECISION_NOT_ALLOWED";
    throw new HttpError(code === "OVER_BALANCE_REQUIRES_ESCALATION" ? 409 : 400, code);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.absenceRequest.updateMany({
      where: { id, status: input.expectedStatus },
      data: { status: toStatus, resolvedAt: toStatus === "APPROVED" || toStatus === "DECLINED" ? new Date() : null },
    });
    if (changed.count !== 1) throw new HttpError(409, "REQUEST_STATUS_CHANGED");
    await tx.approvalAction.create({ data: { requestId: id, actorSubject: actor.auth0Subject, actorName: actor.displayName, action: input.action, fromStatus: existing.status, toStatus, comment: input.comment } });
    if (toStatus === "CANCELLED") await tx.requestBalanceAllocation.updateMany({ where: { requestId: id, reversedAt: null }, data: { reversedAt: new Date() } });
    if (existing.parentRequestId && (toStatus === "APPROVED" || toStatus === "DECLINED")) {
      const parentStatus = toStatus === "APPROVED" ? "CANCELLED" : "APPROVED";
      await tx.absenceRequest.update({ where: { id: existing.parentRequestId }, data: { status: parentStatus, resolvedAt: toStatus === "APPROVED" ? new Date() : undefined } });
      if (toStatus === "APPROVED") await tx.requestBalanceAllocation.updateMany({ where: { requestId: existing.parentRequestId, reversedAt: null }, data: { reversedAt: new Date() } });
    }
    return tx.absenceRequest.findUniqueOrThrow({ where: { id } });
  });
  await audit(request, `REQUEST_${input.action}`, "AbsenceRequest", id, { from: existing.status, to: toStatus });
  if (toStatus === "PENDING_FINAL_APPROVAL") {
    const finals = await prisma.employeeMirror.findMany({ where: { roles: { has: "FERIE_FINAL_APPROVER" }, status: "ACTIVE" }, select: { email: true } });
    for (const final of finals) await enqueueNotification(id, final.email, "FINAL_APPROVAL_REQUIRED");
  } else await enqueueNotification(id, existing.employee.email, `REQUEST_${toStatus}`);
  return serializeRequest(await getRequest(updated.id));
}

export async function withdrawOrCancel(request: Request, id: string) {
  const actor = await actorEmployee(request);
  const existing = await getRequest(id);
  if (existing.employeeId !== actor.id && !actor.roles.includes("FERIE_PORTAL_ADMIN")) throw new HttpError(403, "REQUEST_OWNER_REQUIRED");
  let toStatus: "WITHDRAWN" | "CANCELLATION_REQUESTED";
  if (existing.status === "PENDING_APPROVAL" || existing.status === "PENDING_FINAL_APPROVAL") toStatus = "WITHDRAWN";
  else if (existing.status === "APPROVED") toStatus = "CANCELLATION_REQUESTED";
  else throw new HttpError(409, "REQUEST_CANNOT_BE_WITHDRAWN");
  await prisma.absenceRequest.update({ where: { id }, data: { status: toStatus } });
  if (toStatus === "WITHDRAWN" && existing.parentRequestId) await prisma.absenceRequest.update({ where: { id: existing.parentRequestId }, data: { status: "APPROVED" } });
  await prisma.approvalAction.create({ data: { requestId: id, actorSubject: actor.auth0Subject, actorName: actor.displayName, action: toStatus === "WITHDRAWN" ? "WITHDRAW" : "REQUEST_CANCELLATION", fromStatus: existing.status, toStatus } });
  await audit(request, toStatus, "AbsenceRequest", id);
  if (toStatus === "CANCELLATION_REQUESTED") for (const recipient of await approverRecipients(existing.employeeId)) await enqueueNotification(id, recipient, "CANCELLATION_APPROVAL_REQUIRED");
  return serializeRequest(await getRequest(id));
}

async function requestWouldExceedBalance(requestId: string): Promise<boolean> {
  const entry = await prisma.absenceRequest.findUniqueOrThrow({ where: { id: requestId }, include: { allocations: { include: { account: true } } } });
  const balances = await getBalanceSummaries(entry.employeeId);
  const parentAllocations = entry.parentRequestId ? await prisma.requestBalanceAllocation.findMany({ where: { requestId: entry.parentRequestId, reversedAt: null }, include: { account: true } }) : [];
  return entry.allocations.some((allocation) => {
    const balance = balances.find((item) => item.code === allocation.account.code);
    const replacementCredit = parentAllocations.filter((item) => item.account.code === allocation.account.code).reduce((sum, item) => sum + number(item.amount), 0);
    return balance?.projected !== null && balance?.projected !== undefined && balance.projected + replacementCredit - number(allocation.amount) < 0;
  });
}

export async function listCalendar(request: Request, scope: "personal" | "department", from: string, to: string) {
  const actor = await actorEmployee(request);
  const where: Prisma.AbsenceRequestWhereInput = {
    status: { in: ["APPROVED", "CHANGE_REQUESTED", "CANCELLATION_REQUESTED"] },
    startDate: { lte: dbDate(to) },
    endDate: { gte: dbDate(from) },
    ...(scope === "personal" ? { employeeId: actor.id } : { employee: { departmentId: actor.departmentId } }),
  };
  const entries = await prisma.absenceRequest.findMany({ where, include: { employee: true, absenceType: true }, orderBy: { startDate: "asc" } });
  const visible = entries.filter((entry) => scope === "personal" || entry.absenceType.departmentVisibility !== "HIDDEN");
  if (visible.some((entry) => entry.absenceType.sensitivity === "SENSITIVE")) await audit(request, "SENSITIVE_CALENDAR_ACCESSED", "Calendar", actor.departmentId, { scope, count: visible.filter((entry) => entry.absenceType.sensitivity === "SENSITIVE").length });
  return visible.map((entry) => ({
    id: entry.id,
    employeeName: entry.employee.displayName,
    startDate: isoDate(entry.startDate),
    endDate: isoDate(entry.endDate),
    startTime: entry.startTime,
    endTime: entry.endTime,
    typeLabelIt: scope === "personal" || entry.absenceType.departmentVisibility === "EXACT" ? entry.absenceType.labelIt : "Assente",
    typeLabelEn: scope === "personal" || entry.absenceType.departmentVisibility === "EXACT" ? entry.absenceType.labelEn : "Absent",
    sensitive: entry.absenceType.sensitivity === "SENSITIVE",
  }));
}

export async function createSensitiveAbsence(request: Request, raw: unknown) {
  const input = sensitiveAbsenceSchema.parse(raw);
  const actor = await actorEmployee(request);
  if (!actor.roles.includes("FERIE_PORTAL_ADMIN")) throw new HttpError(403, "ADMIN_REQUIRED");
  const target = await findEmployeeForInput(request, input.employeeId);
  const absenceType = await prisma.absenceType.findUnique({ where: { code: input.absenceTypeCode } });
  if (!absenceType || absenceType.entryMode !== "ADMIN_ONLY") throw new HttpError(400, "ADMIN_ABSENCE_TYPE_REQUIRED");
  const holidays = await effectiveHolidayDates(input.startDate, input.endDate);
  const calculation = calculateVacationDays(input.startDate, input.endDate, target.schedule as unknown as WorkInterval[], holidays);
  const created = await prisma.absenceRequest.create({
    data: {
      employeeId: target.id,
      absenceTypeId: absenceType.id,
      startDate: dbDate(input.startDate),
      endDate: dbDate(input.endDate),
      quantity: calculation.quantityDays,
      unit: "DAYS",
      status: "APPROVED",
      provenance: "ADMIN_MANUAL",
      submittedAt: new Date(),
      resolvedAt: new Date(),
      employeeSnapshot: { employeeNumber: target.employeeNumber, displayName: target.displayName, departmentId: target.departmentId, fte: number(target.fte), schedule: target.schedule },
      calculationSnapshot: { segments: calculation.deductibleDates },
      segments: { create: calculation.deductibleDates.map((date) => ({ date: dbDate(date), quantity: 1, unit: "DAYS" })) },
      decisions: { create: { actorSubject: actor.auth0Subject, actorName: actor.displayName, action: "APPROVE", toStatus: "APPROVED" } },
    },
  });
  await audit(request, "SENSITIVE_ABSENCE_CREATED", "AbsenceRequest", created.id, { absenceTypeCode: input.absenceTypeCode });
  return serializeRequest(await getRequest(created.id));
}

export async function previewBalanceImport(request: Request, raw: unknown) {
  const actor = await actorEmployee(request);
  if (!actor.roles.includes("FERIE_PORTAL_ADMIN")) throw new HttpError(403, "ADMIN_REQUIRED");
  const input = balanceImportSchema.parse(raw);
  const checksum = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const duplicate = await prisma.importBatch.findUnique({ where: { checksum } });
  const employees = await prisma.employeeMirror.findMany({ where: { employeeNumber: { in: input.rows.map((row) => row.employeeNumber) } } });
  const accounts = await prisma.balanceAccount.findMany({ where: { code: { in: input.rows.map((row) => row.accountCode) } } });
  const rows = input.rows.map((row, index) => {
    const employee = employees.find((entry) => entry.employeeNumber === row.employeeNumber);
    const account = accounts.find((entry) => entry.code === row.accountCode);
    const errors = [!employee ? "EMPLOYEE_NOT_FOUND" : null, !account ? "ACCOUNT_NOT_FOUND" : null].filter(Boolean);
    return { rowNumber: index + 1, ...row, employeeId: employee?.id, accountId: account?.id, errors };
  });
  return { input, checksum, duplicateBatchId: duplicate?.id ?? null, rows, validCount: rows.filter((row) => row.errors.length === 0).length, errorCount: rows.filter((row) => row.errors.length > 0).length };
}

export async function commitBalanceImport(request: Request, raw: unknown) {
  const preview = await previewBalanceImport(request, raw);
  if (preview.duplicateBatchId) throw new HttpError(409, "DUPLICATE_IMPORT");
  if (preview.errorCount > 0) throw new HttpError(400, "IMPORT_HAS_ERRORS");
  const previous = new Map<string, number | null>();
  for (const row of preview.rows) {
    const balance = (await getBalanceSummaries(row.employeeId!)).find((entry) => entry.code === row.accountCode);
    previous.set(`${row.employeeId}:${row.accountCode}`, balance?.projected ?? null);
  }
  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.importBatch.create({ data: { sourceName: preview.input.sourceName, checksum: preview.checksum, cutoffDate: dbDate(preview.input.cutoffDate), status: "COMMITTED", rowCount: preview.rows.length, validCount: preview.validCount, errorCount: 0, errors: [], createdBy: request.actor.subject, committedAt: new Date() } });
    for (const row of preview.rows) {
      await tx.importLine.create({ data: { batchId: created.id, rowNumber: row.rowNumber, employeeNumber: row.employeeNumber, employeeId: row.employeeId!, accountCode: row.accountCode, accountId: row.accountId!, amount: row.amount, asOf: dbDate(row.asOf) } });
      await tx.balanceSnapshot.create({ data: { employeeId: row.employeeId!, accountId: row.accountId!, amount: row.amount, asOf: dbDate(row.asOf), cutoffDate: dbDate(preview.input.cutoffDate), importBatchId: created.id } });
      const expected = previous.get(`${row.employeeId}:${row.accountCode}`);
      await tx.reconciliationCase.create({ data: { status: expected === null || expected === undefined ? "UNRECONCILED" : Math.abs(expected - row.amount) < 0.001 ? "MATCHED" : "DISCREPANCY", externalReference: `${created.id}:${row.rowNumber}`, expectedAmount: expected, actualAmount: row.amount } });
    }
    return created;
  });
  await audit(request, "BALANCE_IMPORT_COMMITTED", "ImportBatch", batch.id, { rowCount: batch.rowCount, checksum: batch.checksum });
  return batch;
}

export async function createBalanceAdjustment(request: Request, raw: unknown) {
  const actor = await assertCurrentRole(request, ["FERIE_PORTAL_ADMIN"]);
  const input = balanceAdjustmentSchema.parse(raw);
  const [employee, account] = await Promise.all([
    prisma.employeeMirror.findUnique({ where: { id: input.employeeId } }),
    prisma.balanceAccount.findUnique({ where: { code: input.accountCode } }),
  ]);
  if (!employee) throw new HttpError(404, "EMPLOYEE_NOT_FOUND");
  if (!account) throw new HttpError(404, "BALANCE_ACCOUNT_NOT_FOUND");
  const adjustment = await prisma.manualBalanceAdjustment.create({ data: { employeeId: employee.id, accountId: account.id, amount: input.amount, effectiveDate: dbDate(input.effectiveDate), reason: input.reason, createdBy: actor.auth0Subject } });
  await audit(request, "BALANCE_ADJUSTMENT_CREATED", "ManualBalanceAdjustment", adjustment.id, { employeeId: employee.id, accountCode: account.code, amount: input.amount, reason: input.reason });
  return adjustment;
}

export async function resolveReconciliation(request: Request, id: string, raw: unknown) {
  await assertCurrentRole(request, ["FERIE_PORTAL_ADMIN"]);
  const resolution = typeof (raw as { resolution?: unknown })?.resolution === "string" ? (raw as { resolution: string }).resolution.trim() : "";
  if (resolution.length < 3 || resolution.length > 500) throw new HttpError(400, "RESOLUTION_REQUIRED");
  const result = await prisma.reconciliationCase.update({ where: { id }, data: { status: "RESOLVED", resolution, resolvedAt: new Date() } }).catch(() => { throw new HttpError(404, "RECONCILIATION_NOT_FOUND"); });
  await audit(request, "RECONCILIATION_RESOLVED", "ReconciliationCase", id, { resolution });
  return result;
}

export async function importFutureAbsences(request: Request, raw: unknown) {
  await assertCurrentRole(request, ["FERIE_PORTAL_ADMIN"]);
  const input = futureAbsenceImportSchema.parse(raw);
  const createdIds: string[] = [];
  const errors: Array<{ rowNumber: number; code: string }> = [];
  for (const [index, row] of input.rows.entries()) {
    try {
      if (row.externalReference) {
        const duplicate = await prisma.reconciliationCase.findFirst({ where: { externalReference: row.externalReference } });
        if (duplicate) throw new HttpError(409, "DUPLICATE_EXTERNAL_REFERENCE");
      }
      const employee = await prisma.employeeMirror.findUnique({ where: { employeeNumber: row.employeeNumber }, include: { department: true } });
      if (!employee) throw new HttpError(404, "EMPLOYEE_NOT_FOUND");
      const rawPreview = row.absenceTypeCode === "PERMESSO"
        ? { ...row, employeeId: employee.id, endDate: row.startDate, startTime: row.startTime, endTime: row.endTime }
        : { ...row, employeeId: employee.id, allocations: row.allocations };
      const preview = await previewRequest(request, rawPreview);
      const allocations = row.absenceTypeCode === "FERIE" && preview.allocations.length === 0 ? [{ accountCode: "FERIE", amount: preview.quantity }] : preview.allocations;
      if (row.absenceTypeCode === "FERIE" && !allocationsEqualDays(allocations, preview.quantity)) throw new HttpError(400, "ALLOCATIONS_MUST_EQUAL_DEDUCTIBLE_DAYS");
      const type = await prisma.absenceType.findUniqueOrThrow({ where: { code: row.absenceTypeCode } });
      const result = await prisma.$transaction(async (tx) => {
        const entry = await tx.absenceRequest.create({ data: { employeeId: employee.id, absenceTypeId: type.id, startDate: dbDate(row.startDate), endDate: dbDate(row.endDate), startTime: row.startTime, endTime: row.endTime, quantity: preview.quantity, unit: preview.unit, status: "APPROVED", provenance: "EXTERNAL_IMPORT", reconciliationStatus: row.externalReference ? "MATCHED" : "UNRECONCILED", employeeSnapshot: { employeeNumber: employee.employeeNumber, displayName: employee.displayName, departmentId: employee.departmentId, departmentName: employee.department.name, fte: number(employee.fte), schedule: employee.schedule }, calculationSnapshot: { sourceName: input.sourceName, segments: preview.segments.map((segment) => ({ date: segment.date, quantity: segment.quantity, exclusionReason: segment.exclusionReason })), allocations }, submittedAt: new Date(), resolvedAt: new Date(), segments: { create: preview.segments.map((segment) => ({ date: dbDate(segment.date), quantity: segment.quantity, unit: preview.unit, exclusionReason: segment.exclusionReason })) } } });
        for (const allocation of allocations) {
          const account = await tx.balanceAccount.findUniqueOrThrow({ where: { code: allocation.accountCode } });
          await tx.requestBalanceAllocation.create({ data: { requestId: entry.id, accountId: account.id, amount: allocation.amount } });
        }
        await tx.reconciliationCase.create({ data: { requestId: entry.id, status: row.externalReference ? "MATCHED" : "UNRECONCILED", externalReference: row.externalReference, expectedAmount: preview.quantity, actualAmount: preview.quantity } });
        return entry;
      });
      createdIds.push(result.id);
    } catch (error) {
      errors.push({ rowNumber: index + 1, code: error instanceof HttpError ? error.code : "IMPORT_ROW_FAILED" });
    }
  }
  await audit(request, "FUTURE_ABSENCES_IMPORTED", "AbsenceImport", createHash("sha256").update(JSON.stringify(input)).digest("hex"), { sourceName: input.sourceName, created: createdIds.length, errors });
  return { createdIds, errors };
}

export async function listAdminData(request: Request) {
  const actor = await actorEmployee(request);
  if (!actor.roles.includes("FERIE_PORTAL_ADMIN")) throw new HttpError(403, "ADMIN_REQUIRED");
  const [employees, imports, reconciliation, auditEvents, absenceTypes] = await Promise.all([
    prisma.employeeMirror.findMany({ where: { status: "ACTIVE" }, include: { department: true }, orderBy: { displayName: "asc" } }),
    prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.reconciliationCase.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.absenceType.findMany({ orderBy: { code: "asc" } }),
  ]);
  return {
    employees: employees.map((entry) => ({ id: entry.id, employeeNumber: entry.employeeNumber, displayName: entry.displayName, departmentName: entry.department.name })),
    imports,
    reconciliation,
    audit: auditEvents,
    absenceTypes,
  };
}

export async function updateAbsenceTypeVisibility(request: Request, id: string, raw: unknown) {
  await assertCurrentRole(request, ["FERIE_PORTAL_ADMIN"]);
  const value = typeof (raw as { departmentVisibility?: unknown })?.departmentVisibility === "string" ? (raw as { departmentVisibility: string }).departmentVisibility : "";
  if (!(["EXACT", "GENERIC", "HIDDEN"] as const).includes(value as never)) throw new HttpError(400, "INVALID_CALENDAR_VISIBILITY");
  const result = await prisma.absenceType.update({ where: { id }, data: { departmentVisibility: value as "EXACT" | "GENERIC" | "HIDDEN" } }).catch(() => { throw new HttpError(404, "ABSENCE_TYPE_NOT_FOUND"); });
  await audit(request, "ABSENCE_VISIBILITY_UPDATED", "AbsenceType", id, { departmentVisibility: value });
  return result;
}

export async function listHolidayRules(request: Request) {
  await assertCurrentRole(request, ["FERIE_PORTAL_ADMIN"]);
  return prisma.holidayRule.findMany({ orderBy: [{ kind: "asc" }, { code: "asc" }] });
}

export async function upsertHolidayRule(request: Request, raw: Record<string, unknown>) {
  const actor = await actorEmployee(request);
  if (!actor.roles.includes("FERIE_PORTAL_ADMIN")) throw new HttpError(403, "ADMIN_REQUIRED");
  const code = String(raw.code ?? "").trim().toUpperCase();
  if (!code) throw new HttpError(400, "HOLIDAY_CODE_REQUIRED");
  const data = {
    labelIt: String(raw.labelIt ?? ""),
    labelEn: String(raw.labelEn ?? ""),
    kind: String(raw.kind ?? "CUSTOM") as "CUSTOM",
    recurrence: String(raw.recurrence ?? "ONE_OFF") as "ONE_OFF",
    oneOffDate: typeof raw.oneOffDate === "string" ? dbDate(raw.oneOffDate) : null,
    month: typeof raw.month === "number" ? raw.month : null,
    day: typeof raw.day === "number" ? raw.day : null,
    easterOffset: typeof raw.easterOffset === "number" ? raw.easterOffset : null,
    active: raw.active !== false,
  };
  const result = await prisma.holidayRule.upsert({ where: { code }, create: { code, ...data }, update: data });
  await audit(request, "HOLIDAY_RULE_UPSERTED", "HolidayRule", result.id, { code });
  return result;
}
