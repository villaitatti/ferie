import { describe, expect, it } from "vitest";
import { splitMobileNavigation } from "./mobile-navigation";

describe("mobile navigation", () => {
  it("keeps every authorized destination reachable through overflow", () => {
    const navigation = ["/", "/new", "/requests", "/approvals", "/calendar", "/admin", "/integrations"];
    expect(splitMobileNavigation(navigation)).toEqual({
      primary: ["/", "/new", "/requests", "/approvals"],
      overflow: ["/calendar", "/admin", "/integrations"],
    });
  });

  it("keeps five or fewer destinations directly visible", () => {
    const navigation = ["/", "/new", "/requests", "/calendar", "/integrations"];
    expect(splitMobileNavigation(navigation)).toEqual({ primary: navigation, overflow: [] });
  });
});
