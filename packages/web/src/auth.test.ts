import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./auth";

describe("Auth0 return paths", () => {
  it("preserves local deep links and rejects external redirects", () => {
    expect(safeReturnTo("/requests/request-1?source=email")).toBe("/requests/request-1?source=email");
    expect(safeReturnTo("https://example.org/requests/request-1")).toBe("/");
    expect(safeReturnTo("//example.org/requests/request-1")).toBe("/");
  });
});
