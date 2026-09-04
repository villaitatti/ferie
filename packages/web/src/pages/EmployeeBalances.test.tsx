// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import i18n from "../i18n";
import { installBrowserShims, renderWithProviders } from "../test-setup";
import { EmployeeBalances } from "./EmployeeBalances";

vi.mock("../api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api")>();
  return { ...original, api: vi.fn() };
});

const account = { code: "FERIE", labelIt: "Ferie", labelEn: "Annual leave", unit: "DAYS" as const };

function balance(available: number | null, pending = 0) {
  return { ...account, imported: available, approvedFuture: 0, pending, projected: available, available, asOf: available === null ? null : "2026-08-01", stale: false };
}

const overview = {
  accounts: [account],
  employees: [
    { id: "emp-a", employeeNumber: "1001", displayName: "Anna Verdi", title: null, departmentName: "Research", status: "ACTIVE", balances: [balance(12)] },
    { id: "emp-b", employeeNumber: "1002", displayName: "Bruno Neri", title: null, departmentName: "Finance", status: "ACTIVE", balances: [balance(3)] },
    { id: "emp-c", employeeNumber: "1003", displayName: "Carla Bruni", title: null, departmentName: "Research", status: "ACTIVE", balances: [balance(null)] },
    { id: "emp-d", employeeNumber: "1004", displayName: "Dario Fo", title: null, departmentName: "Research", status: "INACTIVE", balances: [balance(7)] },
  ],
};

function rowNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll("tbody tr td:first-child p:first-child")].map((cell) => cell.textContent ?? "");
}

describe("EmployeeBalances", () => {
  beforeAll(async () => {
    installBrowserShims();
    await i18n.changeLanguage("en");
  });

  it("lists active employees with the row count, hiding inactive ones by default", async () => {
    vi.mocked(api).mockResolvedValue(overview as never);
    const { container } = renderWithProviders(<EmployeeBalances />);

    expect(await screen.findByText("Anna Verdi")).not.toBeNull();
    expect(rowNames(container)).toEqual(["Anna Verdi", "Bruno Neri", "Carla Bruni"]);
    expect(screen.getByText("1–3 of 3")).not.toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(rowNames(container)).toEqual(["Anna Verdi", "Bruno Neri", "Carla Bruni", "Dario Fo"]);
    expect(screen.getByText("1–4 of 4")).not.toBeNull();
  });

  it("filters by the search box across name, number, and department", async () => {
    vi.mocked(api).mockResolvedValue(overview as never);
    const { container } = renderWithProviders(<EmployeeBalances />);
    await screen.findByText("Anna Verdi");

    fireEvent.change(screen.getByRole("textbox", { name: "Search by name, number, or department" }), { target: { value: "finance" } });
    expect(rowNames(container)).toEqual(["Bruno Neri"]);
    expect(screen.getByText("1–1 of 1")).not.toBeNull();
  });

  it("sorts by a balance column with unknown balances always last", async () => {
    vi.mocked(api).mockResolvedValue(overview as never);
    const { container } = renderWithProviders(<EmployeeBalances />);
    await screen.findByText("Anna Verdi");

    fireEvent.click(screen.getByRole("button", { name: "Annual leave" }));
    expect(rowNames(container)).toEqual(["Bruno Neri", "Anna Verdi", "Carla Bruni"]);
    fireEvent.click(screen.getByRole("button", { name: "Annual leave" }));
    expect(rowNames(container)).toEqual(["Anna Verdi", "Bruno Neri", "Carla Bruni"]);
  });
});
