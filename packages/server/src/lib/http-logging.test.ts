import { describe, expect, it } from "vitest";
import { protectedLogPrefix, sanitizeLogUrl, serializeHttpRequest, serializeHttpResponse, technicalErrorDescriptor } from "./http-logging.js";

describe("privacy-safe HTTP logging", () => {
  it("collapses protected paths and removes every query string", () => {
    expect(sanitizeLogUrl("/api/requests/request-secret/decision?employee=1001")).toBe("/api/requests");
    expect(sanitizeLogUrl("/api/admin/sensitive-absences?from=2026-08-01")).toBe("/api/admin");
    expect(sanitizeLogUrl("/api/health?verbose=true")).toBe("/api/health");
    expect(protectedLogPrefix("/api/request-calendar?from=2026-08-01")).toBe("/api/request-calendar");
  });

  it("keeps only operational request fields", () => {
    expect(serializeHttpRequest({
      id: "request-id",
      method: "POST",
      originalUrl: "/api/admin/sensitive-absences?employee=1001",
      url: "/ignored",
      headers: { authorization: "Bearer secret" },
      body: { absenceTypeCode: "MALATTIA" },
    })).toEqual({ id: "request-id", method: "POST", url: "/api/admin" });
    expect(serializeHttpResponse({ statusCode: 201, headers: { "set-cookie": "secret" }, body: { employee: "Andrea" } })).toEqual({ statusCode: 201 });
  });

  it("reduces technical errors to non-sensitive identifiers", () => {
    expect(technicalErrorDescriptor(Object.assign(new Error("medical detail"), { code: "P2002" }))).toEqual({ name: "Error", code: "P2002" });
  });
});
