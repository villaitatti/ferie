// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "./i18n";
import { BalanceTile } from "./components";
import { installBrowserShims, renderWithProviders } from "./test-setup";

describe("BalanceTile", () => {
  beforeAll(async () => {
    installBrowserShims();
    await i18n.changeLanguage("en");
  });

  it("does not present a missing imported balance as zero", () => {
    renderWithProviders(<BalanceTile balance={{
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
    }} />);

    expect(screen.getByText("—")).not.toBeNull();
    expect(screen.getByText("Balance unavailable")).not.toBeNull();
    expect(screen.queryByText("0 d")).toBeNull();
    expect(screen.queryByText("Balance needs updating")).toBeNull();
  });
});
