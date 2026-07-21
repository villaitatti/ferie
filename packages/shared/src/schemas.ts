import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { WORKFLOW_STATUSES } from "./types.js";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const timeOnly = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm");

const validCalendarDate = dateOnly.refine((value) => {
  try {
    Temporal.PlainDate.from(value);
    return true;
  } catch {
    return false;
  }
}, "Expected a valid calendar date");

export const requestCalendarRangeSchema = z.object({
  from: validCalendarDate,
  to: validCalendarDate,
}).superRefine(({ from, to }, context) => {
  let start: Temporal.PlainDate;
  let end: Temporal.PlainDate;
  try {
    start = Temporal.PlainDate.from(from);
    end = Temporal.PlainDate.from(to);
  } catch {
    return;
  }
  const days = end.since(start).days;
  if (days < 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "End date must not precede start date", path: ["to"] });
  if (days > 3_660) context.addIssue({ code: z.ZodIssueCode.custom, message: "Calendar range cannot exceed 3660 days", path: ["to"] });
});

export const vacationPreviewSchema = z.object({
  absenceTypeCode: z.enum(["FERIE", "MALATTIA", "LEGGE_104", "CONGEDO_PARENTALE"]),
  startDate: dateOnly,
  endDate: dateOnly,
  allocations: z.array(z.object({ accountCode: z.enum(["FERIE", "EX_FESTIVITA"]), amount: z.number().nonnegative() })).default([]),
  employeeId: z.string().optional(),
});

export const permissionPreviewSchema = z.object({
  absenceTypeCode: z.literal("PERMESSO"),
  startDate: dateOnly,
  endDate: dateOnly,
  startTime: timeOnly,
  endTime: timeOnly,
  employeeId: z.string().optional(),
});

export const requestPreviewSchema = z.discriminatedUnion("absenceTypeCode", [
  vacationPreviewSchema,
  permissionPreviewSchema,
]);

export const submitRequestSchema = requestPreviewSchema.and(z.object({ revisionOfId: z.string().optional() }));

export const decisionSchema = z.object({
  action: z.enum(["APPROVE", "DECLINE", "ESCALATE"]),
  comment: z.string().trim().max(500).optional(),
  expectedStatus: z.enum(WORKFLOW_STATUSES),
});

export const sensitiveAbsenceSchema = z.object({
  employeeId: z.string(),
  absenceTypeCode: z.enum(["MALATTIA", "LEGGE_104", "CONGEDO_PARENTALE"]),
  startDate: dateOnly,
  endDate: dateOnly,
});

export const balanceImportRowSchema = z.object({
  employeeNumber: z.string().min(1),
  accountCode: z.enum(["FERIE", "EX_FESTIVITA", "PERMESSO"]),
  amount: z.number().nonnegative(),
  asOf: dateOnly,
});

export const balanceImportSchema = z.object({
  sourceName: z.string().trim().min(1).max(120),
  cutoffDate: dateOnly,
  rows: z.array(balanceImportRowSchema).min(1),
});

export const balanceAdjustmentSchema = z.object({
  employeeId: z.string(),
  accountCode: z.enum(["FERIE", "EX_FESTIVITA", "PERMESSO"]),
  amount: z.number().refine((value) => value !== 0),
  effectiveDate: dateOnly,
  reason: z.string().trim().min(3).max(300),
});

export const futureAbsenceImportSchema = z.object({
  sourceName: z.string().trim().min(1).max(120),
  rows: z.array(z.object({
    employeeNumber: z.string().min(1),
    absenceTypeCode: z.enum(["FERIE", "PERMESSO", "MALATTIA", "LEGGE_104", "CONGEDO_PARENTALE"]),
    startDate: dateOnly,
    endDate: dateOnly,
    startTime: timeOnly.optional(),
    endTime: timeOnly.optional(),
    allocations: z.array(z.object({ accountCode: z.enum(["FERIE", "EX_FESTIVITA", "PERMESSO"]), amount: z.number().positive() })).default([]),
    externalReference: z.string().trim().max(120).optional(),
  })).min(1),
});

export type RequestPreviewInput = z.infer<typeof requestPreviewSchema>;
export type SubmitRequestInput = z.infer<typeof submitRequestSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
export type SensitiveAbsenceInput = z.infer<typeof sensitiveAbsenceSchema>;
export type BalanceImportInput = z.infer<typeof balanceImportSchema>;
export type BalanceAdjustmentInput = z.infer<typeof balanceAdjustmentSchema>;
export type FutureAbsenceImportInput = z.infer<typeof futureAbsenceImportSchema>;
