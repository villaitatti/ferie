import { Temporal } from "@js-temporal/polyfill";
import type { RequestCalendarDay, RequestCalendarMarker, WorkInterval } from "@ferie/shared";
import { validatePermissionInterval } from "@ferie/shared";

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

const PERMISSION_STEP_MINUTES = 30;

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number) as [number, number];
  return hour * 60 + minute;
}

function minutesToTime(total: number): string {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function workIntervalsForDate(date: string, schedule: WorkInterval[]) {
  const weekday = Temporal.PlainDate.from(date).dayOfWeek;
  const intervals = schedule
    .filter((interval) => interval.weekday === weekday)
    .map((interval) => ({ start: timeToMinutes(interval.start), end: timeToMinutes(interval.end) }))
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start);
  if (intervals.length === 0) return [];
  const merged: Array<{ start: number; end: number }> = [{ ...intervals[0]! }];
  for (const interval of intervals.slice(1)) {
    const last = merged[merged.length - 1]!;
    if (interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

/** Half-hour start times inside the work schedule for the given date. */
export function permissionStartSlots(date: string, schedule: WorkInterval[]): string[] {
  const slots = new Set<string>();
  for (const interval of workIntervalsForDate(date, schedule)) {
    let cursor = Math.ceil(interval.start / PERMISSION_STEP_MINUTES) * PERMISSION_STEP_MINUTES;
    while (cursor < interval.end) {
      slots.add(minutesToTime(cursor));
      cursor += PERMISSION_STEP_MINUTES;
    }
  }
  return [...slots]
    .filter((start) => permissionEndSlots(date, schedule, start).length > 0)
    .sort();
}

/** Half-hour end times after `startTime` that remain inside the work schedule and under the daily permesso cap. */
export function permissionEndSlots(date: string, schedule: WorkInterval[], startTime: string): string[] {
  const start = timeToMinutes(startTime);
  const slots = new Set<string>();
  for (const interval of workIntervalsForDate(date, schedule)) {
    let cursor = interval.start % PERMISSION_STEP_MINUTES === 0
      ? interval.start + PERMISSION_STEP_MINUTES
      : Math.ceil(interval.start / PERMISSION_STEP_MINUTES) * PERMISSION_STEP_MINUTES;
    while (cursor <= interval.end) {
      if (cursor > start) slots.add(minutesToTime(cursor));
      cursor += PERMISSION_STEP_MINUTES;
    }
  }
  return [...slots]
    .filter((endTime) => {
      try {
        validatePermissionInterval(date, startTime, endTime, schedule);
        return true;
      } catch {
        return false;
      }
    })
    .sort();
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
