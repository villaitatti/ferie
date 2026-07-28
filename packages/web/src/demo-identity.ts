import type { DevIdentity } from "./api";

export const DEMO_SUBJECT_KEY = "ferie-demo-subject";
export const DEFAULT_DEMO_SUBJECT = "auth0|demo-employee";

/** Fallback list for a freshly seeded database, before any Employee Directory sync has run. */
export const SEEDED_IDENTITIES = [
  { value: "auth0|demo-employee", label: "Andrea · Staff" },
  { value: "auth0|demo-approver", label: "Elena · Pre-approver" },
  { value: "auth0|demo-responsible", label: "Marco · HOD" },
  { value: "auth0|demo-final", label: "Giulia · HR / Final" },
  { value: "auth0|demo-it", label: "Luca · IT" },
];

export function isDemoMode(): boolean {
  return import.meta.env.VITE_AUTH_DISABLED !== "false";
}

export function currentDemoSubject(): string {
  return localStorage.getItem(DEMO_SUBJECT_KEY) ?? DEFAULT_DEMO_SUBJECT;
}

const ROLE_LABELS: Record<string, string> = {
  STAFF_IT: "IT",
  FERIE_PORTAL_ADMIN: "Admin",
  FERIE_FINAL_APPROVER: "Final",
};

export function identityLabel(identity: DevIdentity): string {
  const roles = identity.roles.map((role) => ROLE_LABELS[role] ?? role).join("/");
  return [identity.displayName, identity.departmentName, roles].filter(Boolean).join(" · ");
}

/**
 * A directory sync deactivates the seeded demo rows, so a stored subject can stop resolving. Keeping
 * it in the list means the switcher still renders the current selection and can move away from it,
 * instead of showing an empty control on the "identity not found" screen.
 */
export function demoIdentityOptions(identities: DevIdentity[] | undefined, subject: string): Array<{ value: string; label: string }> {
  const options = identities?.length ? identities.map((identity) => ({ value: identity.auth0Subject, label: identityLabel(identity) })) : SEEDED_IDENTITIES;
  if (options.some((option) => option.value === subject)) return options;
  return [{ value: subject, label: `${subject} (not in directory)` }, ...options];
}
