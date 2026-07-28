import { describe, expect, it } from "vitest";
import type { DevIdentity } from "./api";
import { demoIdentityOptions, identityLabel, SEEDED_IDENTITIES } from "./demo-identity";

function identity(overrides: Partial<DevIdentity> = {}): DevIdentity {
  return {
    auth0Subject: "auth0|ed-201",
    employeeNumber: "201",
    displayName: "Andrea Caselli",
    email: "andrea.caselli@example.org",
    departmentName: "Information Technology",
    roles: [],
    ...overrides,
  };
}

describe("demo identity labels", () => {
  it("shows the department and any application roles", () => {
    expect(identityLabel(identity())).toBe("Andrea Caselli · Information Technology");
    expect(identityLabel(identity({ roles: ["STAFF_IT", "FERIE_PORTAL_ADMIN"] }))).toBe("Andrea Caselli · Information Technology · IT/Admin");
  });
});

describe("demo identity options", () => {
  it("falls back to the seeded identities before the first directory sync", () => {
    expect(demoIdentityOptions(undefined, "auth0|demo-employee")).toEqual(SEEDED_IDENTITIES);
    expect(demoIdentityOptions([], "auth0|demo-employee")).toEqual(SEEDED_IDENTITIES);
  });

  it("lists every synchronized employee", () => {
    const options = demoIdentityOptions([identity(), identity({ auth0Subject: "auth0|ed-202", displayName: "Elena Bianchi" })], "auth0|ed-201");
    expect(options.map((option) => option.value)).toEqual(["auth0|ed-201", "auth0|ed-202"]);
  });

  it("keeps a stale stored subject selectable so the switcher can move away from it", () => {
    const options = demoIdentityOptions([identity()], "auth0|demo-employee");
    expect(options[0]).toEqual({ value: "auth0|demo-employee", label: "auth0|demo-employee (not in directory)" });
    expect(options).toHaveLength(2);
  });
});
