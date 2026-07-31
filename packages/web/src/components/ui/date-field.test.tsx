// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../i18n";
import { installBrowserShims } from "../../test-setup";
import { DateField } from "./date-field";

describe("DateField", () => {
  beforeAll(async () => {
    installBrowserShims();
    await i18n.changeLanguage("en");
  });

  it("reaches historical dates well outside the current decade", async () => {
    render(<DateField label="Start date" value="1999-03-04" onChange={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: /^Start date/ }));

    // The caption's year dropdown must include the value's year: an arbitrary ±5-year window
    // once clamped the displayed month, cutting off valid historical records.
    const [, year] = await screen.findAllByRole("combobox");
    expect(year).toHaveTextContent("1999");
  });
});
