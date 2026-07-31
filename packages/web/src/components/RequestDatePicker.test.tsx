// @vitest-environment jsdom

import { fireEvent, screen, within } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { api } from "../api";
import { installBrowserShims, renderWithProviders } from "../test-setup";
import { RequestDatePicker } from "./RequestDatePicker";

vi.mock("../api", () => ({ api: vi.fn() }));

const apiMock = vi.mocked(api);
const schedule = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "09:00", end: "17:00" }));

describe("RequestDatePicker", () => {
  beforeAll(async () => {
    installBrowserShims();
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

    renderWithProviders(<RequestDatePicker
      kind="FERIE"
      startDate="2026-11-09"
      endDate="2026-11-09"
      schedule={schedule}
      onChange={() => undefined}
    />);

    const input = screen.getByLabelText("Leave request period");
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

    // Base UI binds native mouseenter/mousemove listeners on the trigger rather than React handlers,
    // and its delayed open needs the move a real pointer produces on arrival.
    const dayContent = holiday.querySelector(".request-picker-day")!;
    fireEvent.mouseEnter(dayContent);
    fireEvent.mouseMove(dayContent);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("Sunday, 01 November 2026");
    expect(tooltip.textContent).toContain("Holiday or closure");
    expect(tooltip.textContent).toContain("All Saints' Day");
  });

  it("reopens the range when a complete selection is clicked again", async () => {
    apiMock.mockResolvedValue({ from: "2026-01-01", to: "2026-12-31", days: [] });
    const onChange = vi.fn();

    renderWithProviders(<RequestDatePicker
      kind="FERIE"
      startDate="2026-11-09"
      endDate="2026-11-09"
      schedule={schedule}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByLabelText("Leave request period"));
    // By role, because the trigger's accessible name now ends with the selected date too.
    fireEvent.click(await screen.findByRole("button", { name: "09 November 2026" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-09", "");
  });

  it("closes an open range on the second date and validates the whole period", async () => {
    apiMock.mockResolvedValue({ from: "2026-01-01", to: "2026-12-31", days: [] });
    const onChange = vi.fn();

    renderWithProviders(<RequestDatePicker
      kind="FERIE"
      startDate="2026-11-09"
      endDate=""
      schedule={schedule}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByLabelText("Leave request period"));
    fireEvent.click(await screen.findByLabelText("12 November 2026"));
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith("2026-11-09", "2026-11-12"));
    // A settled period has nothing left to ask, so the panel dismisses itself.
    await vi.waitFor(() => expect(screen.queryByText("November 2026")).toBeNull());
  });

  it("keeps the panel open when the completed period conflicts with an existing request", async () => {
    apiMock.mockResolvedValue({
      from: "2026-01-01",
      to: "2026-12-31",
      days: [{ date: "2026-11-11", holidays: [], requests: [{ requestId: "other", state: "APPROVED", absenceTypeCode: "FERIE", labelIt: "Ferie", labelEn: "Annual leave", startTime: null, endTime: null }] }],
    });
    const onChange = vi.fn();

    renderWithProviders(<RequestDatePicker
      kind="FERIE"
      startDate="2026-11-09"
      endDate=""
      schedule={schedule}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByLabelText("Leave request period"));
    fireEvent.click(await screen.findByLabelText(/^12 November 2026$/));
    // The period is refused, so the range reopens and the grid stays up for the next pick.
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith("2026-11-09", ""));
    expect(screen.getByText("November 2026")).not.toBeNull();
    expect(screen.getByText(/overlaps/)).not.toBeNull();
  });

  it("moves focus between days with the arrow keys", async () => {
    apiMock.mockResolvedValue({ from: "2026-01-01", to: "2026-12-31", days: [] });

    renderWithProviders(<RequestDatePicker
      kind="FERIE"
      startDate="2026-11-09"
      endDate=""
      schedule={schedule}
      onChange={() => undefined}
    />);

    fireEvent.click(screen.getByLabelText("Leave request period"));
    const day = await screen.findByRole("button", { name: "12 November 2026" });
    // fireEvent.focus rather than day.focus(): jsdom's focus() does not reach React's onFocus, and
    // react-day-picker only moves focus from a day it knows is focused.
    fireEvent.focus(day);
    fireEvent.keyDown(day, { key: "ArrowRight" });
    // The generated day button builds a ref and focuses it from an effect but never attached it, so
    // arrow-key navigation was inert; this pins the local fix in calendar.tsx.
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "13 November 2026" })));
  });

  it("clears the hover band when the panel closes, so reopening does not paint a stale preview", async () => {
    apiMock.mockResolvedValue({ from: "2026-01-01", to: "2026-12-31", days: [] });
    const changes = vi.fn();

    function Controlled() {
      const [dates, setDates] = useState<[string, string]>(["2026-11-09", ""]);
      return <RequestDatePicker
        kind="FERIE"
        startDate={dates[0]}
        endDate={dates[1]}
        schedule={schedule}
        onChange={(start, end) => { changes(start, end); setDates([start, end]); }}
      />;
    }
    renderWithProviders(<Controlled />);

    fireEvent.click(screen.getByLabelText("Leave request period"));
    // Hover far out while the range is half-open, then complete it — the panel closes before any
    // pointer-leave can fire, which used to leave the hover behind.
    fireEvent.mouseEnter(await screen.findByRole("button", { name: "20 November 2026" }));
    fireEvent.click(screen.getByRole("button", { name: "12 November 2026" }));
    await vi.waitFor(() => expect(screen.queryByText("November 2026")).toBeNull());

    fireEvent.click(screen.getByLabelText(/^Leave request period/));
    fireEvent.click(await screen.findByRole("button", { name: "16 November 2026" }));
    // A new half-open range starting on the 16th must not show a band out to the stale 20th.
    await vi.waitFor(() => expect(changes).toHaveBeenLastCalledWith("2026-11-16", ""));
    expect(document.querySelector("[data-preview]")).toBeNull();
  });

  it("keeps the day cells mounted across a hover, so a second click still registers", async () => {
    apiMock.mockResolvedValue({ from: "2026-01-01", to: "2026-12-31", days: [] });
    const onChange = vi.fn();

    renderWithProviders(<RequestDatePicker
      kind="FERIE"
      startDate="2026-11-09"
      endDate=""
      schedule={schedule}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByLabelText("Leave request period"));
    const target = await screen.findByLabelText("12 November 2026");
    // Moving across the grid used to remount every cell, which dropped the click between mousedown and
    // mouseup because the element the pointer went down on no longer existed.
    fireEvent.mouseEnter(await screen.findByLabelText("11 November 2026"));
    fireEvent.mouseEnter(target);
    expect(screen.getByLabelText("12 November 2026")).toBe(target);
    fireEvent.click(target);
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith("2026-11-09", "2026-11-12"));
  });
});
