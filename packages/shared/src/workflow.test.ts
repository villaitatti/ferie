import { describe, expect, it } from "vitest";
import { resolveDecisionTransition } from "./workflow.js";

describe("approval state machine", () => {
  it("allows a current approver to decide an in-balance request", () => {
    expect(resolveDecisionTransition({ status: "PENDING_APPROVAL", action: "APPROVE", overBalance: false, isFinalApprover: false })).toBe("APPROVED");
    expect(resolveDecisionTransition({ status: "PENDING_APPROVAL", action: "DECLINE", overBalance: false, isFinalApprover: false })).toBe("DECLINED");
  });

  it("forces an over-balance request through final approval", () => {
    expect(() => resolveDecisionTransition({ status: "PENDING_APPROVAL", action: "APPROVE", overBalance: true, isFinalApprover: false })).toThrow("OVER_BALANCE_REQUIRES_ESCALATION");
    expect(resolveDecisionTransition({ status: "PENDING_APPROVAL", action: "ESCALATE", overBalance: true, isFinalApprover: false })).toBe("PENDING_FINAL_APPROVAL");
    expect(resolveDecisionTransition({ status: "PENDING_FINAL_APPROVAL", action: "APPROVE", overBalance: true, isFinalApprover: true })).toBe("APPROVED");
  });

  it("restores or cancels an approved request after cancellation review", () => {
    expect(resolveDecisionTransition({ status: "CANCELLATION_REQUESTED", action: "DECLINE", overBalance: false, isFinalApprover: false })).toBe("APPROVED");
    expect(resolveDecisionTransition({ status: "CANCELLATION_REQUESTED", action: "APPROVE", overBalance: false, isFinalApprover: false })).toBe("CANCELLED");
  });
});
