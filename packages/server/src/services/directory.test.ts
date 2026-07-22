import { describe, expect, it } from "vitest";
import { newlyAssignedRecipients } from "./directory.js";

describe("directory reassignment notifications", () => {
  it("returns only recipients newly introduced by a sync", () => {
    expect(newlyAssignedRecipients(["a@example.org", "b@example.org"], ["b@example.org", "c@example.org", "c@example.org"])).toEqual(["c@example.org"]);
    expect(newlyAssignedRecipients(["a@example.org"], ["a@example.org"])).toEqual([]);
  });
});
