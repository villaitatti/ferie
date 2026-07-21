import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  employeeFindUnique: vi.fn(),
  requestFindUnique: vi.fn(),
  assignmentCount: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    employeeMirror: { findUnique: mocks.employeeFindUnique },
    absenceRequest: { findUnique: mocks.requestFindUnique },
    approverAssignment: { count: mocks.assignmentCount },
  },
}));
vi.mock("./audit.js", () => ({ audit: vi.fn() }));
vi.mock("./queue.js", () => ({ enqueueNotification: vi.fn() }));

import { getRequestDetail } from "./portal.js";

const request = { actor: { subject: "auth0|approver", roles: [] } } as unknown as Request;
const entry = {
  id: "request-1",
  employeeId: "employee-1",
  employee: { displayName: "Andrea Caselli", departmentId: "department-1", department: { name: "Research" } },
  absenceType: { code: "FERIE", labelIt: "Ferie", labelEn: "Annual leave" },
  startDate: new Date("2026-08-03T00:00:00.000Z"),
  endDate: new Date("2026-08-05T00:00:00.000Z"),
  startTime: null,
  endTime: null,
  quantity: 3,
  unit: "DAYS",
  status: "PENDING_APPROVAL",
  provenance: "SELF_SERVICE",
  overBalance: false,
  submittedAt: new Date("2026-07-21T09:00:00.000Z"),
  allocations: [],
  segments: [],
  decisions: [{ id: "decision-1", actorName: "Andrea Caselli", action: "SUBMIT", fromStatus: null, toStatus: "PENDING_APPROVAL", comment: null, createdAt: new Date("2026-07-21T09:00:00.000Z") }],
};

describe("request detail access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.employeeFindUnique.mockResolvedValue({ id: "approver-1", roles: [], department: {} });
    mocks.assignmentCount.mockResolvedValue(1);
    mocks.requestFindUnique.mockResolvedValue(entry);
  });

  it("lets a current approver open an emailed self-service request", async () => {
    const detail = await getRequestDetail(request, "request-1");
    expect(detail.permissions.canDecide).toBe(true);
    expect(detail.permissions.approvalContext).toBe(true);
    expect(detail.decisions).toEqual([expect.objectContaining({ actorName: "Andrea Caselli", createdAt: "2026-07-21T09:00:00.000Z" })]);
    expect(detail.decisions[0]).not.toHaveProperty("actorSubject");
  });

  it("does not expose an HR-created sensitive record through an approver assignment", async () => {
    mocks.requestFindUnique.mockResolvedValue({ ...entry, provenance: "ADMIN_MANUAL", status: "APPROVED" });
    await expect(getRequestDetail(request, "request-1")).rejects.toMatchObject({ status: 403, code: "REQUEST_ACCESS_DENIED" });
  });
});
