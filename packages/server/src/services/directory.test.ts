import { describe, expect, it } from "vitest";
import { grantedRoles, languageNotWrittenSince, newlyAssignedRecipients, superuserEmails } from "./directory.js";

describe("directory reassignment notifications", () => {
  it("returns only recipients newly introduced by a sync", () => {
    expect(newlyAssignedRecipients(["a@example.org", "b@example.org"], ["b@example.org", "c@example.org", "c@example.org"])).toEqual(["c@example.org"]);
    expect(newlyAssignedRecipients(["a@example.org"], ["a@example.org"])).toEqual([]);
  });
});

describe("preferred language write guard", () => {
  const syncStarted = new Date("2026-07-28T10:00:00.000Z");

  it("targets the employee and only rows the portal has not written since the sync started", () => {
    expect(languageNotWrittenSince("ed-1001", syncStarted)).toEqual({
      sourceId: "ed-1001",
      OR: [{ preferredLanguageUpdatedAt: null }, { preferredLanguageUpdatedAt: { lt: syncStarted } }],
    });
  });

  it("uses a strict comparison, so a write in the sync's own start millisecond is preserved", () => {
    const filter = languageNotWrittenSince("ed-1001", syncStarted);
    expect(filter.OR[1]).toEqual({ preferredLanguageUpdatedAt: { lt: syncStarted } });
    expect(filter.OR[1]).not.toEqual({ preferredLanguageUpdatedAt: { lte: syncStarted } });
  });
});

describe("development role grants", () => {
  it("reads a comma separated mailbox list case insensitively", () => {
    expect(superuserEmails(" One@Example.org , two@example.org ,")).toEqual(["one@example.org", "two@example.org"]);
    expect(superuserEmails("")).toEqual([]);
  });

  it("grants administration roles to the configured mailboxes only", () => {
    expect(grantedRoles("Me@Example.org", [], ["me@example.org"])).toEqual(["STAFF_IT", "FERIE_PORTAL_ADMIN", "FERIE_FINAL_APPROVER"]);
    expect(grantedRoles("other@example.org", ["STAFF_IT"], ["me@example.org"])).toEqual(["STAFF_IT"]);
    expect(grantedRoles("me@example.org", [], [])).toEqual([]);
  });

  it("keeps directory roles without duplicating them", () => {
    expect(grantedRoles("me@example.org", ["FERIE_PORTAL_ADMIN"], ["me@example.org"])).toEqual(["FERIE_PORTAL_ADMIN", "STAFF_IT", "FERIE_FINAL_APPROVER"]);
  });
});
