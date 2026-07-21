import type { BalanceSummary, RequestListItem } from "@ferie/shared";

const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
let tokenProvider: (() => Promise<string>) | null = null;

export function setTokenProvider(provider: (() => Promise<string>) | null) {
  tokenProvider = provider;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenProvider ? await tokenProvider() : null;
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (import.meta.env.VITE_AUTH_DISABLED !== "false") headers.set("x-demo-subject", localStorage.getItem("ferie-demo-subject") ?? "auth0|demo-employee");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ code: "REQUEST_FAILED" })) as { code?: string; message?: string };
    throw new ApiError(response.status, payload.code ?? "REQUEST_FAILED", payload.message ?? payload.code ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export interface MeResponse {
  employee: { id: string; displayName: string; email: string; title: string | null; departmentName: string; fte: number; roles: string[]; schedule: Array<{ weekday: number; start: string; end: string }> };
  balances: BalanceSummary[];
  capabilities: { canApprove: boolean; canFinalApprove: boolean; canAdminister: boolean; canInspectIntegrations: boolean };
  pendingApprovals: number;
}

export interface CalendarEntry {
  id: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  typeLabelIt: string;
  typeLabelEn: string;
  sensitive: boolean;
}

export interface PreviewResponse {
  quantity: number;
  unit: "DAYS" | "MINUTES";
  segments: Array<{
    date: string;
    quantity: number;
    exclusionReason?: string;
    holidays?: Array<{ code: string; kind: string; labelIt: string; labelEn: string }>;
  }>;
  allocations: Array<{ accountCode: string; amount: number }>;
  balances: BalanceSummary[];
  overBalance: boolean;
}

export type { BalanceSummary, RequestListItem };
