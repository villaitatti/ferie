// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, type MeResponse, type PreviewResponse } from "../api";
import i18n from "../i18n";
import { installBrowserShims, renderWithProviders } from "../test-setup";
import { NewRequest } from "./NewRequest";

vi.mock("../api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api")>();
  return { ...original, api: vi.fn() };
});

vi.mock("../components/RequestDatePicker", () => ({
  RequestDatePicker: ({ startDate, onChange }: { startDate: string; onChange: (startDate: string, endDate: string) => void }) => <>
    <span data-testid="picker-start-date">{startDate}</span>
    <button type="button" onClick={() => onChange("2026-08-03", "2026-08-07")}>Select dates</button>
    <button type="button" onClick={() => onChange("2026-08-03", "2026-08-03")}>Select day</button>
  </>,
}));

const me: MeResponse = {
  employee: {
    id: "employee",
    displayName: "Andrea Caselli",
    email: "andrea@example.org",
    title: null,
    departmentName: "Research",
    preferredLanguage: "IT",
    fte: 1,
    roles: [],
    schedule: [1, 2, 3, 4, 5].flatMap((weekday) => [
      { weekday, start: "09:00", end: "13:00" },
      { weekday, start: "13:30", end: "17:00" },
    ]),
  },
  balances: [],
  capabilities: { canApprove: false, canFinalApprove: false, canAdminister: false, canInspectIntegrations: false, canChangePreferredLanguage: true },
  pendingApprovals: 0,
};

const preview: PreviewResponse = {
  quantity: 5,
  unit: "DAYS",
  segments: ["03", "04", "05", "06", "07"].map((day) => ({ date: `2026-08-${day}`, quantity: 1 })),
  allocations: [],
  balances: [
    { code: "FERIE", labelIt: "Ferie", labelEn: "Annual leave", unit: "DAYS", imported: 18, approvedFuture: 2, pending: 0, projected: 16, available: 16, asOf: "2026-06-30", stale: false },
    { code: "EX_FESTIVITA", labelIt: "Ex festività", labelEn: "Former public holidays", unit: "DAYS", imported: 4, approvedFuture: 0, pending: 0, projected: 4, available: 4, asOf: "2026-06-30", stale: false },
  ],
  overBalance: false,
};

describe("NewRequest", () => {
  beforeAll(async () => {
    installBrowserShims();
    await i18n.changeLanguage("en");
  });

  it("loads the allocation step automatically after a complete date selection", async () => {
    vi.mocked(api).mockResolvedValue(preview);

    renderWithProviders(<MemoryRouter><NewRequest me={me} /></MemoryRouter>);

    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Select dates" }));

    expect(await screen.findByText("Balance allocation")).not.toBeNull();
    expect(api).toHaveBeenCalledWith("/requests/preview", expect.objectContaining({ method: "POST" }));
    expect(screen.getByTestId("picker-start-date").textContent).toBe("2026-08-03");

    fireEvent.click(screen.getByText("Hourly leave"));
    expect(screen.getByTestId("picker-start-date").textContent).toBe("");
    expect(screen.queryByRole("combobox", { name: "Start time" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "End time" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select day" }));
    expect(screen.getByRole("combobox", { name: "Start time" })).not.toBeNull();
    expect(screen.queryByRole("combobox", { name: "End time" })).toBeNull();

    fireEvent.click(screen.getByRole("combobox", { name: "Start time" }));
    fireEvent.click(await screen.findByRole("option", { name: "09:00" }));
    expect(screen.getByRole("combobox", { name: "End time" })).not.toBeNull();
  });
});
