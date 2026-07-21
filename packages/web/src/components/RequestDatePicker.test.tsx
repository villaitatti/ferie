// @vitest-environment jsdom

import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { api } from "../api";
import { RequestDatePicker } from "./RequestDatePicker";

vi.mock("../api", () => ({ api: vi.fn() }));

const apiMock = vi.mocked(api);
const schedule = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "09:00", end: "17:00" }));

describe("RequestDatePicker", () => {
  beforeAll(async () => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    await i18n.changeLanguage("en");
  });

  it("renders holiday, approved, pending, and non-working day metadata", async () => {
    apiMock.mockResolvedValue({
      from: "2026-01-01",
      to: "2026-12-31",
      days: [
        { date: "2026-11-01", holidays: [{ code: "OGNISSANTI", kind: "NATIONAL", labelIt: "Ognissanti", labelEn: "All Saints' Day" }], requests: [] },
        { date: "2026-11-09", holidays: [], requests: [{ requestId: "approved", state: "APPROVED", absenceTypeCode: "FERIE", labelIt: "Ferie", labelEn: "Annual leave", startTime: null, endTime: null }] },
        { date: "2026-11-12", holidays: [], requests: [{ requestId: "pending", state: "PENDING", absenceTypeCode: "FERIE", labelIt: "Ferie", labelEn: "Annual leave", startTime: null, endTime: null }] },
        { date: "2026-11-16", holidays: [], requests: [{ requestId: "permission-approved", state: "APPROVED", absenceTypeCode: "PERMESSO", labelIt: "Permesso", labelEn: "Hourly leave", startTime: "09:00", endTime: "10:00" }] },
        { date: "2026-11-17", holidays: [], requests: [{ requestId: "permission-pending", state: "PENDING", absenceTypeCode: "PERMESSO", labelIt: "Permesso", labelEn: "Hourly leave", startTime: "15:00", endTime: "16:00" }] },
      ],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MantineProvider><QueryClientProvider client={client}><RequestDatePicker
      kind="FERIE"
      startDate="2026-11-09"
      endDate="2026-11-09"
      schedule={schedule}
      onChange={() => undefined}
    /></QueryClientProvider></MantineProvider>);

    const input = screen.getByLabelText("Request period");
    expect(input.textContent).toBe("09 November 2026");
    fireEvent.click(input);
    await screen.findByText("November 2026");

    const holiday = await screen.findByLabelText(/All Saints' Day/);
    const approved = screen.getByLabelText(/Approved annual leave: Annual leave/);
    const pending = screen.getByLabelText(/Annual leave pending approval: Annual leave/);
    const permissionApproved = screen.getByLabelText(/Approved hourly leave: Hourly leave/);
    const permissionPending = screen.getByLabelText(/Hourly leave pending approval: Hourly leave/);
    const weekend = screen.getByLabelText(/07 November 2026\. Non-working day/);
    expect(screen.getByText("one day").tagName).toBe("STRONG");
    expect(screen.getByText("date range").tagName).toBe("STRONG");
    expect(screen.getByText(/click the same date twice/)).not.toBeNull();
    expect(screen.getByText(/select the first and last day/)).not.toBeNull();
    expect(within(screen.getByRole("list", { name: "Calendar legend" })).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Holiday or closure",
      "Non-working day",
      "Approved annual leave",
      "Annual leave pending approval",
      "Approved hourly leave",
      "Hourly leave pending approval",
    ]);
    expect(holiday.querySelector(".request-picker-dot-red")).not.toBeNull();
    expect(approved.querySelector(".request-picker-dot-green")).not.toBeNull();
    expect(pending.querySelector(".request-picker-dot-yellow")).not.toBeNull();
    expect(permissionApproved.querySelector(".request-picker-dot-blue")).not.toBeNull();
    expect(permissionPending.querySelector(".request-picker-dot-violet")).not.toBeNull();
    expect(weekend.getAttribute("data-non-working")).toBe("true");
    expect(holiday.getAttribute("title")).toBeNull();
    fireEvent.mouseEnter(holiday.querySelector(".request-picker-day")!);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("Sunday, 01 November 2026");
    expect(tooltip.textContent).toContain("Holiday or closure");
    expect(tooltip.textContent).toContain("All Saints' Day");
  });
});
