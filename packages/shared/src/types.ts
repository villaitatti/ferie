export const WORKFLOW_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "PENDING_FINAL_APPROVAL",
  "APPROVED",
  "DECLINED",
  "WITHDRAWN",
  "CHANGE_REQUESTED",
  "CANCELLATION_REQUESTED",
  "CANCELLED",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type RequestProvenance = "SELF_SERVICE" | "ADMIN_MANUAL" | "EXTERNAL_IMPORT";
export type ReconciliationStatus = "UNRECONCILED" | "MATCHED" | "DISCREPANCY" | "RESOLVED";
export type BalanceUnit = "DAYS" | "MINUTES";
export type DurationMode = "FULL_DAY_RANGE" | "MINUTES_SINGLE_DAY";
export type AppRole = "FERIE_FINAL_APPROVER" | "FERIE_PORTAL_ADMIN" | "STAFF_IT";
export type ApprovalRole = "PRE_APPROVER" | "RESPONSABILE" | "SUBSTITUTE_RESPONSABILE";

export interface WorkInterval {
  weekday: number;
  start: string;
  end: string;
}

export interface EmployeeSummary {
  id: string;
  employeeNumber: string;
  auth0Subject: string;
  email: string;
  displayName: string;
  title: string | null;
  departmentId: string;
  departmentName: string;
  status: "ACTIVE" | "INACTIVE";
  fte: number;
  schedule: WorkInterval[];
  roles: AppRole[];
}

export interface BalanceSummary {
  code: string;
  labelIt: string;
  labelEn: string;
  unit: BalanceUnit;
  imported: number | null;
  approvedFuture: number;
  pending: number;
  projected: number | null;
  asOf: string | null;
  stale: boolean;
}

export interface RequestListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentId: string;
  departmentName: string;
  absenceTypeCode: string;
  absenceTypeLabelIt: string;
  absenceTypeLabelEn: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  quantity: number;
  unit: BalanceUnit;
  status: WorkflowStatus;
  provenance: RequestProvenance;
  overBalance: boolean;
  submittedAt: string | null;
  allocations?: Array<{ accountCode: string; amount: number }>;
}

export interface RequestCalendarHoliday {
  code: string;
  kind: "NATIONAL" | "LOCAL" | "CENTRE" | "CUSTOM";
  labelIt: string;
  labelEn: string;
}

export interface RequestCalendarMarker {
  requestId: string;
  state: "APPROVED" | "PENDING";
  absenceTypeCode: string;
  labelIt: string;
  labelEn: string;
  startTime: string | null;
  endTime: string | null;
}

export interface RequestCalendarDay {
  date: string;
  holidays: RequestCalendarHoliday[];
  requests: RequestCalendarMarker[];
}

export interface RequestCalendarResponse {
  from: string;
  to: string;
  days: RequestCalendarDay[];
}
