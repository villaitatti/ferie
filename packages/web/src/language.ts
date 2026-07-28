import type { Language } from "@ferie/shared";

/** Last applied interface language, so a reload paints in it before `/me` answers. */
export const LANGUAGE_CACHE_KEY = "ferie-language";
/** Per-tab switch from the header control. Deliberately not persistent: a new session starts from
 * the Employee Directory preference again, which is what "you see your language when you log in"
 * means. The profile setting is the durable choice, and it writes through to the directory. */
export const SESSION_OVERRIDE_KEY = "ferie-session-language";

export interface SessionOverride {
  employeeId: string;
  language: Language;
}

/** Endonyms, so the choice reads the same whichever language the interface is currently in. */
export const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "IT", label: "Italiano" },
  { value: "EN", label: "English" },
];

export function languageCode(language: Language): "it" | "en" {
  return language === "EN" ? "en" : "it";
}

export function languageFromCode(code: string): Language {
  return code.startsWith("en") ? "EN" : "IT";
}

export function readSessionOverride(): SessionOverride | null {
  const raw = sessionStorage.getItem(SESSION_OVERRIDE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionOverride>;
    if (typeof parsed.employeeId !== "string" || (parsed.language !== "IT" && parsed.language !== "EN")) return null;
    return { employeeId: parsed.employeeId, language: parsed.language };
  } catch {
    return null;
  }
}

/**
 * The directory preference wins unless this tab has switched language for this same employee.
 * Keying the override to the employee means switching identity, or signing in as somebody else,
 * shows that person's own preference instead of the previous tenant of the tab.
 */
export function resolveLanguage(employeeId: string, preferred: Language, override: SessionOverride | null): Language {
  return override && override.employeeId === employeeId ? override.language : preferred;
}
