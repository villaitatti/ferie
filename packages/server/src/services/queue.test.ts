import { describe, expect, it } from "vitest";
import { delegationFor, deliveryGate, mailDelivery } from "./queue.js";

describe("notification delivery target", () => {
  it("sends to the real recipient when no redirect mailbox is configured", () => {
    expect(mailDelivery("employee@example.org", "Aggiornamento", "")).toEqual({ send: true, to: "employee@example.org", subject: "Aggiornamento" });
  });

  it("sends every message to the redirect mailbox and keeps the intended recipient visible", () => {
    expect(mailDelivery("employee@example.org", "Aggiornamento", "me@example.org")).toEqual({
      send: true,
      to: "me@example.org",
      subject: "[dev → employee@example.org] Aggiornamento",
    });
  });

  it("delivers the director's mail to the delegate and never to the director", () => {
    expect(mailDelivery("Director@Example.org", "Azione richiesta", "", { recipientIsDirector: true, delegateEmail: "delegate@example.org" })).toEqual({
      send: true,
      to: "delegate@example.org",
      subject: "[per Director@Example.org] Azione richiesta",
    });
    expect(mailDelivery("employee@example.org", "Aggiornamento", "", { recipientIsDirector: false, delegateEmail: null })).toEqual({
      send: true,
      to: "employee@example.org",
      subject: "Aggiornamento",
    });
  });

  it("suppresses the director's mail instead of delivering it when no active delegate exists", () => {
    expect(mailDelivery("director@example.org", "Azione richiesta", "", { recipientIsDirector: true, delegateEmail: null })).toEqual({
      send: false,
      reason: "DIRECTOR_WITHOUT_DELEGATE",
    });
  });

  it("suppression wins over the development redirect, so a dev database simulates it truthfully", () => {
    expect(mailDelivery("director@example.org", "Azione richiesta", "me@example.org", { recipientIsDirector: true, delegateEmail: null })).toEqual({
      send: false,
      reason: "DIRECTOR_WITHOUT_DELEGATE",
    });
  });

  it("applies the development redirect after delegation so the delegate chain stays visible", () => {
    expect(mailDelivery("director@example.org", "Azione richiesta", "me@example.org", { recipientIsDirector: true, delegateEmail: "delegate@example.org" })).toEqual({
      send: true,
      to: "me@example.org",
      subject: "[dev → delegate@example.org] [per director@example.org] Azione richiesta",
    });
  });
});

describe("director delegation from the mirror", () => {
  it("delegates only for the director, and only to an ACTIVE delegate", () => {
    expect(delegationFor({ isDirector: true }, { email: "delegate@example.org", status: "ACTIVE" })).toEqual({ recipientIsDirector: true, delegateEmail: "delegate@example.org" });
    expect(delegationFor({ isDirector: true }, { email: "delegate@example.org", status: "INACTIVE" })).toEqual({ recipientIsDirector: true, delegateEmail: null });
    expect(delegationFor({ isDirector: true }, null)).toEqual({ recipientIsDirector: true, delegateEmail: null });
    expect(delegationFor({ isDirector: false }, { email: "delegate@example.org", status: "ACTIVE" })).toEqual({ recipientIsDirector: false, delegateEmail: null });
    expect(delegationFor(null, null)).toEqual({ recipientIsDirector: false, delegateEmail: null });
  });
});

describe("delivery gate", () => {
  it("refuses every delivery when a directory is configured but no director-aware sync has succeeded", () => {
    expect(deliveryGate(true, false)).toEqual({ open: false, reason: "DIRECTOR_METADATA_NOT_SYNCED" });
  });

  it("opens once a director-aware sync has succeeded, and stays open without a directory", () => {
    expect(deliveryGate(true, true)).toEqual({ open: true });
    expect(deliveryGate(false, false)).toEqual({ open: true });
  });
});
