import request from "supertest";
import express from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { errorHandler } from "./lib/http.js";

describe("HTTP application", () => {
  it("exposes an unauthenticated health check with security headers", async () => {
    const response = await request(createApp()).get("/api/health").expect(200);
    expect(response.body).toEqual({ status: "ok", service: "ferie-portal" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("maps JWT authentication failures to 401", async () => {
    const app = express();
    app.get("/protected", (_request, _response, next) => next(Object.assign(new Error("invalid token"), { name: "UnauthorizedError" })));
    app.use(errorHandler);
    const response = await request(app).get("/protected").expect(401);
    expect(response.body).toEqual({ code: "UNAUTHORIZED" });
  });
});
