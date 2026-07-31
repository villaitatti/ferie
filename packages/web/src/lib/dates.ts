import { enGB, it } from "react-day-picker/locale";

/**
 * The portal speaks plain `YYYY-MM-DD` everywhere, while react-day-picker works with `Date`.
 * Everything crosses that boundary at local midnight so a browser in any time zone still renders and
 * reports the same calendar day the server stored.
 */
export function toDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

export function toDateOrNull(value: string | null | undefined): Date | undefined {
  return value ? toDate(value) : undefined;
}

export function toIsoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

export function calendarLocale(language: string) {
  return language === "en" ? enGB : it;
}
