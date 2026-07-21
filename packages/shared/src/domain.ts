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

export function validatePermissionInterval(date: string, startTime: string, endTime: string, schedule: WorkInterval[]): number {
  const weekday = Temporal.PlainDate.from(date).dayOfWeek;
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const duration = minutesBetween(startTime, endTime);
  const covered = schedule.some((interval) => interval.weekday === weekday && start >= toMinutes(interval.start) && end <= toMinutes(interval.end));
  if (!covered) throw new Error("OUTSIDE_WORK_SCHEDULE");
  return duration;
}

export function allocationsEqualDays(allocations: Array<{ amount: number }>, days: number): boolean {
  const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  return Math.abs(total - days) < 0.0001;
}
