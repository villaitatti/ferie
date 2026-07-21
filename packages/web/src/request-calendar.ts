import { Temporal } from "@js-temporal/polyfill";
import type { RequestCalendarDay, RequestCalendarMarker, WorkInterval } from "@ferie/shared";

export function formatPortalDate(date: string, language: string): string {
  return Temporal.PlainDate.from(date).toLocaleString(language === "en" ? "en-GB" : "it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatPortalDateTime(timestamp: string, language: string): string {
  return Temporal.Instant.from(timestamp).toZonedDateTimeISO("Europe/Rome").toLocaleString(language === "en" ? "en-GB" : "it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function toDateOnlyString(value: string | Date | null): string | null {
  if (typeof value === "string" || value === null) return value;
  return Temporal.PlainDate.from({
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
  }).toString();
}

export function formatPortalDateWithWeekday(date: string, language: string): string {
  return Temporal.PlainDate.from(date).toLocaleString(language === "en" ? "en-GB" : "it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatPortalList(items: string[], language: string): string {
  return new Intl.ListFormat(language === "en" ? "en-GB" : "it-IT", {
    style: "long",
    type: "conjunction",
  }).format(items);
}

export function formatPortalDateRange(
  startDate: string | null,
  endDate: string | null,
  language: string,
  separator = "–",
): string {
  if (!startDate) return "";
  const formattedStart = formatPortalDate(startDate, language);
  if (!endDate) return `${formattedStart} ${separator} `;
  return startDate === endDate
    ? formattedStart
    : `${formattedStart} ${separator} ${formatPortalDate(endDate, language)}`;
}

export function isScheduledWorkday(date: string, schedule: WorkInterval[]): boolean {
  const weekday = Temporal.PlainDate.from(date).dayOfWeek;
  return schedule.some((interval) => interval.weekday === weekday);
}

export function findRequestConflict(
  days: RequestCalendarDay[],
  startDate: string,
  endDate: string,
  excludedRequestId?: string,
): { date: string; request: RequestCalendarMarker } | null {
  for (const day of days) {
    if (day.date < startDate || day.date > endDate) continue;
    const request = day.requests.find((entry) => entry.requestId !== excludedRequestId);
    if (request) return { date: day.date, request };
  }
  return null;
}
