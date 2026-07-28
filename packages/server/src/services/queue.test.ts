import { describe, expect, it } from "vitest";
import { mailDelivery } from "./queue.js";

describe("notification delivery target", () => {
  it("sends to the real recipient when no redirect mailbox is configured", () => {
    expect(mailDelivery("employee@example.org", "Aggiornamento", "")).toEqual({ to: "employee@example.org", subject: "Aggiornamento" });
  });

  it("sends every message to the redirect mailbox and keeps the intended recipient visible", () => {
    expect(mailDelivery("employee@example.org", "Aggiornamento", "me@example.org")).toEqual({
      to: "me@example.org",
      subject: "[dev → employee@example.org] Aggiornamento",
    });
  });
});
