import type { WorkflowStatus } from "./types.js";

export type Decision = "APPROVE" | "DECLINE" | "ESCALATE";

export function resolveDecisionTransition(input: {
  status: WorkflowStatus;
  action: Decision;
  overBalance: boolean;
  isFinalApprover: boolean;
}): WorkflowStatus {
  const { status, action, overBalance, isFinalApprover } = input;
  if (status === "CANCELLATION_REQUESTED") {
    if (action === "ESCALATE") throw new Error("ESCALATION_NOT_ALLOWED");
    return action === "APPROVE" ? "CANCELLED" : "APPROVED";
  }
  if (status === "PENDING_FINAL_APPROVAL") {
    if (!isFinalApprover) throw new Error("FINAL_APPROVER_REQUIRED");
    if (action === "ESCALATE") throw new Error("ESCALATION_NOT_ALLOWED");
    return action === "APPROVE" ? "APPROVED" : "DECLINED";
  }
  if (status !== "PENDING_APPROVAL") throw new Error("DECISION_NOT_ALLOWED");
  if (action === "ESCALATE") {
    if (!overBalance) throw new Error("ESCALATION_NOT_ALLOWED");
    return "PENDING_FINAL_APPROVAL";
  }
  if (action === "APPROVE" && overBalance) throw new Error("OVER_BALANCE_REQUIRES_ESCALATION");
  return action === "APPROVE" ? "APPROVED" : "DECLINED";
}
