// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SelectField } from "./select-field";

describe("SelectField", () => {
  it("shows the selected option's label in the closed trigger, not the raw value", () => {
    render(<SelectField
      label="Type"
      value="MALATTIA"
      onChange={() => undefined}
      data={[{ value: "MALATTIA", label: "Sick leave" }, { value: "INFORTUNIO", label: "Injury" }]}
    />);

    // Base UI resolves the closed trigger's text from `items` on the root; without it the trigger
    // falls back to the raw value ("MALATTIA"), because the options are unmounted while shut.
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Sick leave");
    expect(trigger).not.toHaveTextContent("MALATTIA");
  });
});
