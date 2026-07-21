import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  employeeFindUnique: vi.fn(),
  holidayFindUnique: vi.fn(),
  holidayUpsert: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    employeeMirror: { findUnique: mocks.employeeFindUnique },
    holidayRule: { findUnique: mocks.holidayFindUnique, upsert: mocks.holidayUpsert },
  },
}));
vi.mock("./audit.js", () => ({ audit: mocks.audit }));
vi.mock("./queue.js", () => ({ enqueueNotification: vi.fn() }));

import { upsertHolidayRule } from "./portal.js";

const request = { actor: { subject: "auth0|admin", roles: [] } } as unknown as Request;
const input = {
  code: "CUSTOM_CLOSURE",
  labelIt: "Chiusura personalizzata",
  labelEn: "Custom closure",
  kind: "CUSTOM",
  recurrence: "ONE_OFF",
  oneOffDate: "2026-08-14",
  active: true,
};

describe("holiday administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.employeeFindUnique.mockResolvedValue({ id: "admin", roles: ["FERIE_PORTAL_ADMIN"], department: {} });
  });

  it("refuses to overwrite a protected seeded rule", async () => {
    mocks.holidayFindUnique.mockResolvedValue({ id: "seeded", code: "CAPODANNO", kind: "NATIONAL" });
    await expect(upsertHolidayRule(request, { ...input, code: "capodanno" })).rejects.toMatchObject({ status: 409, code: "PROTECTED_HOLIDAY_RULE" });
    expect(mocks.holidayUpsert).not.toHaveBeenCalled();
  });

  it("upserts a validated custom rule", async () => {
    mocks.holidayFindUnique.mockResolvedValue(null);
    mocks.holidayUpsert.mockResolvedValue({ id: "custom", ...input });
    await upsertHolidayRule(request, input);
    expect(mocks.holidayUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { code: "CUSTOM_CLOSURE" },
      create: expect.objectContaining({ code: "CUSTOM_CLOSURE", kind: "CUSTOM", recurrence: "ONE_OFF" }),
    }));
  });
});
