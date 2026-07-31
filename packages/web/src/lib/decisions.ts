import type { Tone } from "@/lib/tone";

export type Decision = "APPROVE" | "DECLINE" | "ESCALATE";

/** The approval queue and the request detail page offer the same three decisions, worded the same way. */
export function decisionKey(action: Decision): "approve" | "decline" | "escalate" {
  return action === "APPROVE" ? "approve" : action === "DECLINE" ? "decline" : "escalate";
}

export function decisionTone(action: Decision | null): Tone {
  return action === "DECLINE" ? "red" : action === "ESCALATE" ? "orange" : "green";
}
