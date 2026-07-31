// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import i18n from "../i18n";
import { installBrowserShims, renderWithProviders } from "../test-setup";
import { Admin } from "./Admin";

vi.mock("../api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api")>();
  return { ...original, api: vi.fn() };
});

const adminData = {
  employees: [{ id: "emp-andrea", employeeNumber: "1001", displayName: "Andrea Caselli", departmentName: "Research" }],
  imports: [],
  reconciliation: [],
  audit: [],
  absenceTypes: [{ id: "type-1", code: "MALATTIA", labelIt: "Malattia", labelEn: "Sick leave", departmentVisibility: "GENERIC", sensitivity: "SENSITIVE" }],
};

function mockAdminApi() {
  vi.mocked(api).mockImplementation(async (path: string) => (path === "/admin" ? adminData : []) as never);
}

describe("Admin", () => {
  beforeAll(async () => {
    installBrowserShims();
    await i18n.changeLanguage("en");
  });

  it("drives the HR forms with shadcn controls and no native pickers", async () => {
    mockAdminApi();

    const { container } = renderWithProviders(<Admin />);

    expect(await screen.findByText("Sick leave")).not.toBeNull();
    // Nothing in the portal falls back to the browser's own form chrome.
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector("input[type=date]")).toBeNull();

    // The employee roster is a filtering combobox rather than a long native list.
    const employee = screen.getAllByRole("combobox", { name: "Employee" })[0]!;
    fireEvent.click(employee);
    fireEvent.click(await screen.findByText("Andrea Caselli · Research"));
    expect(employee.textContent).toContain("Andrea Caselli");
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(false);
  });

  it("keeps the balance file behind a styled trigger with the native input hidden", async () => {
    mockAdminApi();

    const { container } = renderWithProviders(<Admin />);

    fireEvent.click(screen.getByRole("tab", { name: "Import balances" }));
    expect(await screen.findByText("Monthly balance file")).not.toBeNull();
    const fileInput = container.querySelector("input[type=file]");
    expect(fileInput).not.toBeNull();
    expect(fileInput?.className).toContain("hidden");
    expect(screen.getAllByRole("button", { name: "Choose CSV or XLSX" }).length).toBeGreaterThan(0);
  });
});
