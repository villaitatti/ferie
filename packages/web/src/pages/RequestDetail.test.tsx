// @vitest-environment jsdom

import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import i18n from "../i18n";
import { RequestDetail } from "./RequestDetail";

vi.mock("../api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api")>();
  return { ...original, api: vi.fn() };
});

describe("RequestDetail", () => {
  beforeAll(async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
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

  it("loads and displays the request identified by the deep link", async () => {
    vi.mocked(api).mockResolvedValue({
      id: "request-1",
      employeeId: "employee-1",
      employeeName: "Andrea Caselli",
      departmentId: "department-1",
      departmentName: "Research",
      absenceTypeCode: "FERIE",
      absenceTypeLabelIt: "Ferie",
      absenceTypeLabelEn: "Annual leave",
      startDate: "2026-08-03",
      endDate: "2026-08-05",
      startTime: null,
      endTime: null,
      quantity: 3,
      unit: "DAYS",
      status: "PENDING_APPROVAL",
      provenance: "SELF_SERVICE",
      overBalance: false,
      submittedAt: "2026-07-21T09:00:00.000Z",
      allocations: [{ accountCode: "FERIE", amount: 3 }],
      decisions: [{ id: "decision-1", actorName: "Andrea Caselli", action: "SUBMIT", fromStatus: null, toStatus: "PENDING_APPROVAL", comment: null, createdAt: "2026-07-21T09:00:00.000Z" }],
      permissions: { canDecide: true, canModify: false, canWithdraw: false, canRequestCancellation: false, approvalContext: true },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(<MantineProvider><QueryClientProvider client={client}><MemoryRouter initialEntries={["/requests/request-1"]}><Routes><Route path="/requests/:id" element={<RequestDetail />} /></Routes></MemoryRouter></QueryClientProvider></MantineProvider>);

    expect(await screen.findByRole("heading", { name: "Annual leave", level: 1 })).not.toBeNull();
    expect(screen.getByText("Balance allocation")).not.toBeNull();
    expect(screen.getByText("Approval history")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Approve" })).not.toBeNull();
    expect(api).toHaveBeenCalledWith("/requests/request-1");
  });
});
