import { Temporal } from "@js-temporal/polyfill";
import type { WorkInterval } from "./types.js";

export interface HolidayOccurrence {
  date: string;
  code: string;
  labelIt: string;
  labelEn: string;
  kind: "NATIONAL" | "LOCAL" | "CENTRE" | "CUSTOM";
}

export interface VacationCalculation {
  deductibleDates: string[];
  excludedDates: Array<{ date: string; reason: "WEEKEND" | "UNSCHEDULED" | "HOLIDAY" }>;
  quantityDays: number;
}

export function calculateBalanceAvailability(
  imported: number | null,
  adjustments: number,
  approvedFuture: number,
  pending: number,
): { projected: number | null; available: number | null } {
  if (imported === null) return { projected: null, available: null };
  const projected = imported + adjustments - approvedFuture;
  return { projected, available: projected - pending };
}

export function easterSunday(year: number): Temporal.PlainDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Temporal.PlainDate.from({ year, month, day });
}

export function holidaysForYear(year: number, includeGoodFriday = true): HolidayOccurrence[] {
  const fixed: Array<readonly [string, string, string, string]> = [
    ["01-01", "CAPODANNO", "Capodanno", "New Year's Day"],
    ["01-06", "EPIFANIA", "Epifania", "Epiphany"],
    ["04-25", "LIBERAZIONE", "Festa della Liberazione", "Liberation Day"],
    ["05-01", "LAVORO", "Festa del Lavoro", "Labour Day"],
    ["06-02", "REPUBBLICA", "Festa della Repubblica", "Republic Day"],
    ["06-24", "SAN_GIOVANNI", "San Giovanni Battista", "Saint John the Baptist"],
    ["08-15", "FERRAGOSTO", "Ferragosto", "Assumption Day"],
    ["11-01", "OGNISSANTI", "Ognissanti", "All Saints' Day"],
    ["12-08", "IMMACOLATA", "Immacolata Concezione", "Immaculate Conception"],
    ["12-25", "NATALE", "Natale", "Christmas Day"],
    ["12-26", "SANTO_STEFANO", "Santo Stefano", "Saint Stephen's Day"],
  ];
  if (year >= 2026) fixed.splice(7, 0, ["10-04", "SAN_FRANCESCO", "San Francesco d'Assisi", "Saint Francis of Assisi"]);

  const occurrences: HolidayOccurrence[] = fixed.map(([day, code, labelIt, labelEn]) => ({
    date: `${year}-${day}`,
    code,
    labelIt,
    labelEn,
    kind: code === "SAN_GIOVANNI" ? "LOCAL" : "NATIONAL",
  }));
  const easter = easterSunday(year);
  occurrences.push({ date: easter.add({ days: 1 }).toString(), code: "PASQUETTA", labelIt: "Lunedì dell'Angelo", labelEn: "Easter Monday", kind: "NATIONAL" });
  if (includeGoodFriday) {
    occurrences.push({ date: easter.subtract({ days: 2 }).toString(), code: "VENERDI_SANTO", labelIt: "Chiusura del Venerdì Santo", labelEn: "Good Friday closure", kind: "CENTRE" });
  }
  return occurrences.sort((left, right) => left.date.localeCompare(right.date));
}

export function calculateVacationDays(
  startDate: string,
  endDate: string,
  schedule: WorkInterval[],
  holidayDates: ReadonlySet<string>,
): VacationCalculation {
  const start = Temporal.PlainDate.from(startDate);
  const end = Temporal.PlainDate.from(endDate);
  if (Temporal.PlainDate.compare(end, start) < 0) throw new Error("END_BEFORE_START");
  const weekdays = new Set(schedule.map((entry) => entry.weekday));
  const deductibleDates: string[] = [];
  const excludedDates: VacationCalculation["excludedDates"] = [];
  for (let day = start; Temporal.PlainDate.compare(day, end) <= 0; day = day.add({ days: 1 })) {
    const date = day.toString();
    if (day.dayOfWeek > 5) excludedDates.push({ date, reason: "WEEKEND" });
    else if (!weekdays.has(day.dayOfWeek)) excludedDates.push({ date, reason: "UNSCHEDULED" });
    else if (holidayDates.has(date)) excludedDates.push({ date, reason: "HOLIDAY" });
    else deductibleDates.push(date);
  }
  return { deductibleDates, excludedDates, quantityDays: deductibleDates.length };
}

export function minutesBetween(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(":").map(Number) as [number, number];
  const [endHour, endMinute] = endTime.split(":").map(Number) as [number, number];
  const result = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (result <= 0) throw new Error("END_TIME_NOT_AFTER_START");
  return result;
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number) as [number, number];
  return hour * 60 + minute;
}

/** At least half an hour of work must remain; a full scheduled day cannot be taken as permesso. */
export const MIN_REMAINING_WORK_MINUTES = 30;

function workIntervalsForDate(date: string, schedule: WorkInterval[]) {
  const weekday = Temporal.PlainDate.from(date).dayOfWeek;
  const intervals = schedule
    .filter((interval) => interval.weekday === weekday)
    .map((interval) => ({ start: toMinutes(interval.start), end: toMinutes(interval.end) }))
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start);
  return mergeWorkIntervals(intervals);
}

/** Collapse overlapping or contiguous intervals so scheduled length is unique wall-clock minutes. */
function mergeWorkIntervals(intervals: Array<{ start: number; end: number }>) {
  if (intervals.length === 0) return [];
  const merged: Array<{ start: number; end: number }> = [{ ...intervals[0]! }];
  for (const interval of intervals.slice(1)) {
    const last = merged[merged.length - 1]!;
    if (interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

export function scheduledWorkingMinutes(date: string, schedule: WorkInterval[]): number {
  return workIntervalsForDate(date, schedule).reduce((sum, interval) => sum + (interval.end - interval.start), 0);
}

/** Max permesso minutes for a day (e.g. 420 on a 7.5h / 450-minute schedule). */
export function maxPermissionMinutesForDay(date: string, schedule: WorkInterval[]): number {
  return Math.max(0, scheduledWorkingMinutes(date, schedule) - MIN_REMAINING_WORK_MINUTES);
}

export function permissionCoveredMinutes(date: string, startTime: string, endTime: string, schedule: WorkInterval[]): number {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  minutesBetween(startTime, endTime);
  if (start % 30 !== 0 || end % 30 !== 0) throw new Error("INVALID_PERMISSION_STEP");
  const intervals = workIntervalsForDate(date, schedule);
  const startIsScheduled = intervals.some((interval) => start >= interval.start && start < interval.end);
  const endIsScheduled = intervals.some((interval) => end > interval.start && end <= interval.end);
  if (!startIsScheduled || !endIsScheduled) throw new Error("OUTSIDE_WORK_SCHEDULE");

  let coveredMinutes = 0;
  let coveredUntil = start;
  for (const interval of intervals) {
    const overlapStart = Math.max(start, interval.start, coveredUntil);
    const overlapEnd = Math.min(end, interval.end);
    if (overlapEnd > overlapStart) {
      coveredMinutes += overlapEnd - overlapStart;
      coveredUntil = overlapEnd;
    }
  }
  if (coveredMinutes === 0) throw new Error("OUTSIDE_WORK_SCHEDULE");
  return coveredMinutes;
}

export function validatePermissionInterval(date: string, startTime: string, endTime: string, schedule: WorkInterval[]): number {
  const coveredMinutes = permissionCoveredMinutes(date, startTime, endTime, schedule);
  if (coveredMinutes > maxPermissionMinutesForDay(date, schedule)) throw new Error("PERMISSION_EXCEEDS_DAILY_MAX");
  return coveredMinutes;
}

export function allocationsEqualDays(allocations: Array<{ amount: number }>, days: number): boolean {
  const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  return Math.abs(total - days) < 0.0001;
}
