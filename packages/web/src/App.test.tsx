// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { api, type MeResponse } from "./api";
import { App } from "./App";
import i18n from "./i18n";
import { installBrowserShims, renderWithProviders } from "./test-setup";

vi.mock("./api", async (importOriginal) => {
  const original = await importOriginal<typeof import("./api")>();
  return { ...original, api: vi.fn() };
});

const me: MeResponse = {
  employee: {
    id: "emp-andrea",
    displayName: "Andrea Caselli",
    email: "andrea@example.org",
    title: "Digital Projects Manager",
    departmentName: "Research",
    preferredLanguage: "EN",
    fte: 1,
    roles: [],
    schedule: [{ weekday: 1, start: "09:00", end: "17:00" }],
  },
  balances: [{ code: "FERIE", labelIt: "Ferie", labelEn: "Annual leave", unit: "DAYS", imported: 18, approvedFuture: 0, pending: 0, projected: 18, available: 18, asOf: "2026-06-30", stale: false }],
  capabilities: { canApprove: true, canFinalApprove: false, canAdminister: true, canInspectIntegrations: true, canChangePreferredLanguage: true },
  pendingApprovals: 2,
};

describe("App shell", () => {
  beforeAll(async () => {
    installBrowserShims();
    await i18n.changeLanguage("en");
  });

  it("renders the navigation, the pending badge, and the profile panel", async () => {
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === "/me") return me as never;
      if (path === "/requests") return [] as never;
      return { identities: [] } as never;
    });

    renderWithProviders(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);

    // The dashboard is lazily loaded, so waiting on its greeting also proves the shell mounted.
    expect(await screen.findByRole("heading", { name: "Welcome, Andrea", level: 1 })).not.toBeNull();
    expect(screen.getAllByText("Approvals").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Andrea Caselli/ }));
    expect(await screen.findByRole("button", { name: "Sign out" })).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Preferred language" })).not.toBeNull();
  });
});
