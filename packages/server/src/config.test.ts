import { describe, expect, it } from "vitest";
import { parseConfig } from "./config.js";

describe("runtime authentication configuration", () => {
  it("allows demo authentication only outside production", () => {
    expect(parseConfig({ NODE_ENV: "development", AUTH_DISABLED: "true" }).AUTH_DISABLED).toBe(true);
    expect(() => parseConfig({ NODE_ENV: "production", AUTH_DISABLED: "true" })).toThrow("AUTH_DISABLED_NOT_ALLOWED_IN_PRODUCTION");
  });

  it("keeps the unauthenticated Employee Directory escape hatch out of production", () => {
    expect(parseConfig({ NODE_ENV: "development", AUTH_DISABLED: "true", ED_DEV_UNAUTHENTICATED: "true" }).ED_DEV_UNAUTHENTICATED).toBe(true);
    expect(() => parseConfig({ NODE_ENV: "production", AUTH_DISABLED: "false", AUTH0_DOMAIN: "tenant.example", AUTH0_AUDIENCE: "ferie-api", ED_DEV_UNAUTHENTICATED: "true" })).toThrow("ED_DEV_UNAUTHENTICATED_NOT_ALLOWED_IN_PRODUCTION");
  });

  it("requires a redirect mailbox whenever a non-production deployment can send mail", () => {
    expect(() => parseConfig({ NODE_ENV: "development", AUTH_DISABLED: "true", SES_FROM_EMAIL: "portal@example.org" })).toThrow("MAIL_REDIRECT_REQUIRED_OUTSIDE_PRODUCTION");
    expect(parseConfig({ NODE_ENV: "development", AUTH_DISABLED: "true", SES_FROM_EMAIL: "portal@example.org", MAIL_REDIRECT_TO: "me@example.org" }).MAIL_REDIRECT_TO).toBe("me@example.org");
    expect(parseConfig({ NODE_ENV: "development", AUTH_DISABLED: "true" }).MAIL_REDIRECT_TO).toBe("");
    expect(() => parseConfig({ NODE_ENV: "development", AUTH_DISABLED: "true", SES_FROM_EMAIL: "portal@example.org", MAIL_REDIRECT_TO: "not-an-address" })).toThrow("MAIL_REDIRECT_TO_INVALID");
  });

  it("rejects development-only overrides in production", () => {
    const production = { NODE_ENV: "production", AUTH_DISABLED: "false", AUTH0_DOMAIN: "tenant.example", AUTH0_AUDIENCE: "ferie-api" };
    expect(() => parseConfig({ ...production, MAIL_REDIRECT_TO: "me@example.org" })).toThrow("MAIL_REDIRECT_NOT_ALLOWED_IN_PRODUCTION");
    expect(() => parseConfig({ ...production, DEV_SUPERUSER_EMAILS: "me@example.org" })).toThrow("DEV_SUPERUSER_EMAILS_NOT_ALLOWED_IN_PRODUCTION");
  });

  it("requires an Auth0 domain and audience in JWT mode", () => {
    expect(() => parseConfig({ NODE_ENV: "test", AUTH_DISABLED: "false" })).toThrow("AUTH0_CONFIGURATION_REQUIRED");
    expect(() => parseConfig({ NODE_ENV: "production", AUTH_DISABLED: "false", AUTH0_DOMAIN: "  ", AUTH0_AUDIENCE: "" })).toThrow("AUTH0_CONFIGURATION_REQUIRED");
    expect(parseConfig({ NODE_ENV: "production", AUTH_DISABLED: "false", AUTH0_DOMAIN: "tenant.example", AUTH0_AUDIENCE: "ferie-api" }).AUTH_DISABLED).toBe(false);
  });
});
