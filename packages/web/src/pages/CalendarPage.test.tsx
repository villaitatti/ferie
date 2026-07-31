// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import i18n from "../i18n";
import { installBrowserShims, renderWithProviders } from "../test-setup";
import { CalendarPage } from "./CalendarPage";

vi.mock("../api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api")>();
  return { ...original, api: vi.fn() };
});

describe("CalendarPage", () => {
  beforeAll(async () => {
    installBrowserShims();
    await i18n.changeLanguage("en");
  });

  it("drives FullCalendar from portal buttons instead of its own toolbar", async () => {
    vi.mocked(api).mockResolvedValue([] as never);

    const { container } = renderWithProviders(<CalendarPage />);

    expect(await screen.findByRole("button", { name: "Next month" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Previous month" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Today" })).not.toBeNull();
    expect(screen.getByRole("radio", { name: "Month" })).not.toBeNull();
    // FullCalendar's own header would render `.fc-toolbar`; the portal replaces it entirely.
    expect(container.querySelector(".fc-toolbar")).toBeNull();
  });
});
