// @vitest-environment jsdom

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { BalanceTile } from "./components";

describe("BalanceTile", () => {
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

  it("does not present a missing imported balance as zero", () => {
    render(<MantineProvider><BalanceTile balance={{
      code: "FERIE",
      labelIt: "Ferie",
      labelEn: "Annual leave",
      unit: "DAYS",
      imported: null,
      approvedFuture: 0,
      pending: 0,
      projected: null,
      available: null,
      asOf: null,
      stale: true,
    }} /></MantineProvider>);

    expect(screen.getByText("—")).not.toBeNull();
    expect(screen.getByText("Balance unavailable")).not.toBeNull();
    expect(screen.queryByText("0 d")).toBeNull();
    expect(screen.queryByText("Balance needs updating")).toBeNull();
  });
});
