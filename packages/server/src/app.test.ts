import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("HTTP application", () => {
  it("exposes an unauthenticated health check with security headers", async () => {
    const response = await request(createApp()).get("/api/health").expect(200);
    expect(response.body).toEqual({ status: "ok", service: "ferie-portal" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
