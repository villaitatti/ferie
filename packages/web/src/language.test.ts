// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { languageCode, languageFromCode, readSessionOverride, resolveLanguage, SESSION_OVERRIDE_KEY } from "./language";

describe("language codes", () => {
  it("maps directory values to interface codes and back", () => {
    expect(languageCode("IT")).toBe("it");
    expect(languageCode("EN")).toBe("en");
    expect(languageFromCode("en")).toBe("EN");
    expect(languageFromCode("it")).toBe("IT");
    expect(languageFromCode("en-GB")).toBe("EN");
  });
});

describe("session override", () => {
  beforeEach(() => sessionStorage.clear());

  it("reads a stored override", () => {
    sessionStorage.setItem(SESSION_OVERRIDE_KEY, JSON.stringify({ employeeId: "emp-1", language: "EN" }));
    expect(readSessionOverride()).toEqual({ employeeId: "emp-1", language: "EN" });
  });

  it("ignores malformed or unknown values instead of throwing", () => {
    expect(readSessionOverride()).toBeNull();
    sessionStorage.setItem(SESSION_OVERRIDE_KEY, "not json");
    expect(readSessionOverride()).toBeNull();
    sessionStorage.setItem(SESSION_OVERRIDE_KEY, JSON.stringify({ employeeId: "emp-1", language: "FR" }));
    expect(readSessionOverride()).toBeNull();
  });
});

describe("interface language resolution", () => {
  it("uses the directory preference when this tab has not switched", () => {
    expect(resolveLanguage("emp-1", "EN", null)).toBe("EN");
    expect(resolveLanguage("emp-1", "IT", null)).toBe("IT");
  });

  it("honours a switch made for the same employee", () => {
    expect(resolveLanguage("emp-1", "IT", { employeeId: "emp-1", language: "EN" })).toBe("EN");
  });

  it("ignores a switch belonging to another employee", () => {
    expect(resolveLanguage("emp-2", "IT", { employeeId: "emp-1", language: "EN" })).toBe("IT");
  });
});
