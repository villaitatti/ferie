import { describe, expect, it } from "vitest";
import { parseConfig } from "./config.js";

describe("runtime authentication configuration", () => {
  it("allows demo authentication only outside production", () => {
    expect(parseConfig({ NODE_ENV: "development", AUTH_DISABLED: "true" }).AUTH_DISABLED).toBe(true);
    expect(() => parseConfig({ NODE_ENV: "production", AUTH_DISABLED: "true" })).toThrow("AUTH_DISABLED_NOT_ALLOWED_IN_PRODUCTION");
  });

  it("requires an Auth0 domain and audience in JWT mode", () => {
    expect(() => parseConfig({ NODE_ENV: "test", AUTH_DISABLED: "false" })).toThrow("AUTH0_CONFIGURATION_REQUIRED");
    expect(parseConfig({ NODE_ENV: "production", AUTH_DISABLED: "false", AUTH0_DOMAIN: "tenant.example", AUTH0_AUDIENCE: "ferie-api" }).AUTH_DISABLED).toBe(false);
  });
});
