import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findEmployee: vi.fn(),
  createAuditEvent: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    employeeMirror: { findUnique: mocks.findEmployee },
    auditEvent: { create: mocks.createAuditEvent },
  },
}));

import { audit } from "./audit.js";

function requestWithRoles(roles: string[]) {
  return {
    actor: { subject: "auth0|employee", roles },
    ip: "127.0.0.1",
  } as Request;
}

describe("audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records current directory roles instead of stale JWT roles", async () => {
    mocks.findEmployee.mockResolvedValue({
      roles: ["FERIE_FINAL_APPROVER", "FERIE_PORTAL_ADMIN"],
    });

    await audit(
      requestWithRoles(["STAFF_IT"]),
      "REQUEST_APPROVED",
      "AbsenceRequest",
      "request-1",
      { status: "APPROVED" },
    );

    expect(mocks.findEmployee).toHaveBeenCalledWith({
      where: { auth0Subject: "auth0|employee" },
      select: { roles: true },
    });
    expect(mocks.createAuditEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorSubject: "auth0|employee",
        actorRole: "FERIE_FINAL_APPROVER",
        metadata: {
          status: "APPROVED",
          actorRoles: ["FERIE_FINAL_APPROVER", "FERIE_PORTAL_ADMIN"],
        },
      }),
    });
  });

  it("does not fall back to JWT roles when the directory actor is missing", async () => {
    mocks.findEmployee.mockResolvedValue(null);

    await audit(
      requestWithRoles(["FERIE_PORTAL_ADMIN"]),
      "HOLIDAY_RULE_UPDATED",
      "HolidayRule",
      "holiday-1",
    );

    expect(mocks.createAuditEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorRole: null,
        metadata: { actorRoles: [] },
      }),
    });
  });
});
