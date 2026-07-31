import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import type { RequestCalendarDay, RequestCalendarMarker, RequestCalendarResponse, WorkInterval } from "@ferie/shared";
import { AlertTriangleIcon, CalendarDaysIcon, XIcon } from "lucide-react";
import { type ComponentProps, createContext, useContext, useEffect, useId, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import { cn } from "@/lib/utils";
import { calendarLocale, toDate, toIsoDate } from "@/lib/dates";
import { toneBorder, toneSoft } from "@/lib/tone";
import { findRequestConflict, formatPortalDate, formatPortalDateRange, formatPortalDateWithWeekday, isScheduledWorkday } from "@/request-calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { FormField, fieldDescribedBy, fieldLabelId } from "@/components/ui/form-field";
import { MonthYearCaption } from "@/components/ui/month-year-caption";
import { PickerSurface } from "@/components/ui/picker-surface";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RequestDatePickerProps {
  kind: "FERIE" | "PERMESSO";
  startDate: string;
  endDate: string;
  schedule: WorkInterval[];
  revisionOfId?: string;
  onChange: (startDate: string, endDate: string) => void;
}

const statusColor = {
  holiday: "red",
  ferieApproved: "green",
  feriePending: "yellow",
  permessoApproved: "blue",
  permessoPending: "violet",
  otherApproved: "gray",
  otherPending: "gray",
} as const;

type MarkerState = keyof typeof statusColor;

function requestMarkerState(request: RequestCalendarMarker): MarkerState {
  if (request.absenceTypeCode === "FERIE") return request.state === "APPROVED" ? "ferieApproved" : "feriePending";
  if (request.absenceTypeCode === "PERMESSO") return request.state === "APPROVED" ? "permessoApproved" : "permessoPending";
  return request.state === "APPROVED" ? "otherApproved" : "otherPending";
}

function yearRange(date: string) {
  const year = date.slice(0, 4);
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function metadataUrl(from: string, to: string) {
  return `/request-calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

interface DayMeta {
  daysByDate: Map<string, RequestCalendarDay>;
  schedule: WorkInterval[];
  locale: "it" | "en";
  holidayLabel: string;
  nonWorkingLabel: string;
  requestStatusLabel: (request: RequestCalendarMarker) => string;
}

/**
 * Day metadata reaches the day cells through context so the `DayButton` component identity stays
 * stable across renders — a fresh component on every render would remount the grid and drop focus
 * and open tooltips while a range is being picked.
 */
const DayMetaContext = createContext<DayMeta | null>(null);

function markerStates(day: RequestCalendarDay | undefined): MarkerState[] {
  return [...new Set<MarkerState>([
    ...(day?.holidays.length ? ["holiday" as const] : []),
    ...(day?.requests.map(requestMarkerState) ?? []),
  ])];
}

function RequestDayButton({ day, modifiers, className, ...props }: ComponentProps<typeof CalendarDayButton>) {
  const meta = useContext(DayMetaContext);
  const date = toIsoDate(day.date);
  const entry = meta?.daysByDate.get(date);
  const states = markerStates(entry);
  const nonWorking = meta ? !isScheduledWorkday(date, meta.schedule) : false;

  const content = (
    <span className="request-picker-day">
      <span>{day.date.getDate()}</span>
      <span className="request-picker-dots">
        {states.map((state) => <span key={state} className={`request-picker-dot request-picker-dot-${statusColor[state]}`} />)}
      </span>
    </span>
  );

  const button = (
    <CalendarDayButton
      day={day}
      modifiers={modifiers}
      data-non-working={nonWorking || undefined}
      data-preview={modifiers.preview || undefined}
      className={cn("request-picker-day-button", className)}
      {...props}
    >
      {states.length === 0 || !meta
        ? content
        // The trigger is the day content inside the day button, so it renders a span, not a button.
        : <TooltipTrigger render={content} />}
    </CalendarDayButton>
  );

  if (states.length === 0 || !meta) return button;

  return (
    <Tooltip>
      {button}
      <TooltipContent variant="surface" side="top" sideOffset={8} className="request-picker-tooltip">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">{formatPortalDateWithWeekday(date, meta.locale)}</p>
          {(entry?.holidays ?? []).map((holiday) => (
            <div key={holiday.code} className="flex items-start gap-2">
              <span className="request-picker-dot request-picker-dot-red request-picker-tooltip-marker" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">{meta.holidayLabel}</p>
                <p className="text-sm font-semibold">{meta.locale === "en" ? holiday.labelEn : holiday.labelIt}</p>
              </div>
            </div>
          ))}
          {nonWorking ? (
            <div className="flex items-center gap-2">
              <span className="request-picker-non-working request-picker-tooltip-marker" aria-hidden="true" />
              <p className="text-sm font-semibold">{meta.nonWorkingLabel}</p>
            </div>
          ) : null}
          {(entry?.requests ?? []).map((request) => {
            const detail = meta.locale === "en" ? request.labelEn : request.labelIt;
            const time = request.startTime && request.endTime ? ` · ${request.startTime}–${request.endTime}` : "";
            return (
              <div key={request.requestId} className="flex items-start gap-2">
                <span className={`request-picker-dot request-picker-dot-${statusColor[requestMarkerState(request)]} request-picker-tooltip-marker`} aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground">{meta.requestStatusLabel(request)}</p>
                  <p className="text-sm font-semibold">{detail}{time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Reproduces Mantine's `allowSingleDateInRange` progression, which the help text describes: the first
 * click opens a range, clicking the same day again closes it on that one day, and clicking once a
 * range is complete starts over.
 */
function nextRange(current: DateRange | undefined, clicked: Date): DateRange {
  if (!current?.from || current.to) return { from: clicked, to: undefined };
  return clicked < current.from ? { from: clicked, to: current.from } : { from: current.from, to: clicked };
}

export function RequestDatePicker({ kind, startDate, endDate, schedule, revisionOfId, onChange }: RequestDatePickerProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [displayedDate, setDisplayedDate] = useState(startDate || Temporal.Now.plainDateISO("Europe/Rome").toString());
  const [hovered, setHovered] = useState<Date | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [selectionMetadataUnavailable, setSelectionMetadataUnavailable] = useState(false);
  const range = yearRange(displayedDate);
  const calendar = useQuery({
    queryKey: ["request-calendar", range.from, range.to],
    queryFn: () => api<RequestCalendarResponse>(metadataUrl(range.from, range.to)),
  });
  const daysByDate = useMemo(() => new Map((calendar.data?.days ?? []).map((day) => [day.date, day])), [calendar.data]);
  const locale = i18n.language === "en" ? "en" : "it";

  useEffect(() => setConflictMessage(null), [kind, revisionOfId]);
  // Re-centre on the selection whenever the panel opens, so a loaded revision shows its own month.
  useEffect(() => { if (open && startDate) setDisplayedDate(startDate); }, [open, startDate]);
  // Closing unmounts the grid before its pointer-leave can fire, so the hover is cleared here too —
  // otherwise reopening and starting a new range paints a band out to wherever the pointer last was.
  useEffect(() => { if (!open) setHovered(null); }, [open]);

  const requestStatusLabel = (request: RequestCalendarMarker) => {
    if (request.absenceTypeCode === "FERIE") return request.state === "APPROVED" ? t("calendarFerieApproved") : t("calendarFeriePending");
    if (request.absenceTypeCode === "PERMESSO") return request.state === "APPROVED" ? t("calendarPermessoApproved") : t("calendarPermessoPending");
    return request.state === "APPROVED" ? t("calendarApproved") : t("calendarPending");
  };

  const dayLabel = (date: string, day?: RequestCalendarDay) => {
    const labels = [formatPortalDate(date, locale)];
    if (!isScheduledWorkday(date, schedule)) labels.push(t("calendarNonWorking"));
    for (const holiday of day?.holidays ?? []) labels.push(`${t("calendarHoliday")}: ${locale === "en" ? holiday.labelEn : holiday.labelIt}`);
    for (const request of day?.requests ?? []) {
      const label = locale === "en" ? request.labelEn : request.labelIt;
      const time = request.startTime && request.endTime ? `, ${request.startTime}-${request.endTime}` : "";
      labels.push(`${requestStatusLabel(request)}: ${label}${time}`);
    }
    return labels.join(". ");
  };

  const dayMeta = useMemo<DayMeta>(() => ({
    daysByDate,
    schedule,
    locale,
    holidayLabel: t("calendarHoliday"),
    nonWorkingLabel: t("calendarNonWorking"),
    requestStatusLabel,
  }), [daysByDate, schedule, locale, i18n.language]);

  const fetchRange = (from: string, to: string) => queryClient.fetchQuery({
    queryKey: ["request-calendar", from, to],
    queryFn: () => api<RequestCalendarResponse>(metadataUrl(from, to)),
    staleTime: 30_000,
  });

  const validateSelection = async (from: string, to: string) => {
    try {
      const result = await fetchRange(from, to);
      setSelectionMetadataUnavailable(false);
      const conflict = findRequestConflict(result.days, from, to, revisionOfId);
      if (!conflict) {
        setConflictMessage(null);
        return true;
      }
      const type = locale === "en" ? conflict.request.labelEn : conflict.request.labelIt;
      const status = requestStatusLabel(conflict.request);
      setConflictMessage(t("calendarConflict", { date: formatPortalDate(conflict.date, locale), type, status }));
      return false;
    } catch {
      setConflictMessage(null);
      setSelectionMetadataUnavailable(true);
      return true;
    }
  };

  const handleRangeChange = async ([from, to]: [string | null, string | null]) => {
    if (!from) {
      setConflictMessage(null);
      onChange("", "");
      return;
    }
    if (!to) {
      setConflictMessage(null);
      onChange(from, "");
      return;
    }
    if (await validateSelection(from, to)) {
      onChange(from, to);
      // The period is settled, so the panel has nothing left to ask. A rejected selection keeps it
      // open instead, ready for the next pick, with the conflict notice already visible below.
      setOpen(false);
    } else {
      onChange(from, "");
    }
  };

  const handleSingleChange = async (date: string | null) => {
    if (!date) {
      setConflictMessage(null);
      onChange("", "");
      return;
    }
    if (await validateSelection(date, date)) {
      onChange(date, date);
      setOpen(false);
    }
  };

  const selectedRange: DateRange | undefined = startDate
    ? { from: toDate(startDate), to: endDate ? toDate(endDate) : undefined }
    : undefined;

  // Highlights the days a click would add while the second end of the range is still open. Hover is
  // only tracked while a range is half-open: re-rendering the whole grid on every cell the pointer
  // crosses would otherwise interrupt the day tooltips for no visible gain.
  const rangeInProgress = kind === "FERIE" && Boolean(selectedRange?.from) && !selectedRange?.to;
  const previewBand = (date: Date) => {
    if (!rangeInProgress || !selectedRange?.from || !hovered) return false;
    const [low, high] = hovered < selectedRange.from ? [hovered, selectedRange.from] : [selectedRange.from, hovered];
    return date > low && date < high;
  };

  const sharedCalendarProps = {
    locale: calendarLocale(locale),
    weekStartsOn: 1 as const,
    month: toDate(displayedDate),
    onMonthChange: (month: Date) => setDisplayedDate(toIsoDate(month)),
    // Only the enter handler is wired: React derives mouseEnter and mouseLeave from the same native
    // move, and clearing on leave races the enter of the cell the pointer arrived at. The grid's own
    // pointer-leave below is the single place the band is cleared.
    onDayMouseEnter: rangeInProgress ? (date: Date) => setHovered(date) : undefined,
    modifiers: { preview: previewBand },
    labels: {
      labelDayButton: (date: Date) => dayLabel(toIsoDate(date), daysByDate.get(toIsoDate(date))),
      labelNext: () => t("calendarNextMonth"),
      labelPrevious: () => t("calendarPreviousMonth"),
    },
    components: { DayButton: RequestDayButton, CaptionLabel: MonthYearCaption },
    className: "request-picker-calendar p-3",
  };

  const value = kind === "FERIE"
    ? formatPortalDateRange(startDate || null, endDate || null, locale)
    : startDate ? formatPortalDate(startDate, locale) : "";
  const placeholder = kind === "FERIE" ? t("calendarChoosePeriod") : t("calendarChooseDate");

  const periodHelp = <span className="request-picker-help">
    <span>{t("calendarSingleDayPrefix")} <strong>{t("calendarSingleDayTerm")}</strong>{t("calendarSingleDaySuffix")}</span>
    <span>{t("calendarRangePrefix")} <strong>{t("calendarRangeTerm")}</strong>{t("calendarRangeSuffix")}</span>
  </span>;

  const trigger = (
    <Button
      id={fieldId}
      type="button"
      variant="outline"
      aria-labelledby={`${fieldLabelId(fieldId)} ${fieldId}`}
      aria-describedby={fieldDescribedBy(fieldId, kind === "FERIE" ? periodHelp : undefined, undefined)}
      className={cn("w-full justify-start gap-2 bg-transparent font-normal", value ? "pr-9" : "text-muted-foreground")}
    >
      <CalendarDaysIcon className="size-[17px] shrink-0 text-muted-foreground" />
      <span className="truncate">{value || placeholder}</span>
    </Button>
  );

  return <div className="request-date-picker">
    <div className="request-date-control">
      <FormField
        id={fieldId}
        label={<span className="request-picker-heading">{kind === "FERIE" ? t("calendarPeriod") : t("permissionDate")}</span>}
        description={kind === "FERIE" ? periodHelp : undefined}
      >
        <DayMetaContext.Provider value={dayMeta}>
          {/* Base UI puts the hover delay on the provider, so the day summaries get their own. */}
          <TooltipProvider delay={120}>
          <div className="relative">
            <PickerSurface
              open={open}
              onOpenChange={setOpen}
              trigger={trigger}
              title={kind === "FERIE" ? t("calendarPeriod") : t("permissionDate")}
            >
              {kind === "FERIE" ? (
                <div onPointerLeave={() => setHovered(null)}>
                  <Calendar
                    {...sharedCalendarProps}
                    mode="range"
                    required={false}
                    resetOnSelect
                    selected={selectedRange}
                    onSelect={(_selected, triggerDate) => {
                      const next = nextRange(selectedRange, triggerDate);
                      void handleRangeChange([next.from ? toIsoDate(next.from) : null, next.to ? toIsoDate(next.to) : null]);
                    }}
                  />
                </div>
              ) : (
                <Calendar
                  {...sharedCalendarProps}
                  mode="single"
                  required={false}
                  selected={startDate ? toDate(startDate) : undefined}
                  onSelect={(date) => { void handleSingleChange(date ? toIsoDate(date) : null); }}
                  disabled={(date) => {
                    const iso = toIsoDate(date);
                    return !isScheduledWorkday(iso, schedule) || Boolean(daysByDate.get(iso)?.holidays.length);
                  }}
                />
              )}
            </PickerSurface>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("calendarClear")}
                onClick={() => { void (kind === "FERIE" ? handleRangeChange([null, null]) : handleSingleChange(null)); }}
                className="absolute top-0.5 right-0.5 text-muted-foreground"
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
          </TooltipProvider>
        </DayMetaContext.Provider>
      </FormField>
    </div>
    <div className="request-picker-legend-block">
      <p className="text-xs font-semibold text-muted-foreground">{t("calendarLegend")}</p>
      <div className="request-picker-legend" role="list" aria-label={t("calendarLegend")}>
        <span className="text-xs" role="listitem"><span className="request-picker-dot request-picker-dot-red" />{t("calendarHoliday")}</span>
        <span className="text-xs" role="listitem"><span className="request-picker-non-working" />{t("calendarNonWorking")}</span>
        <span className="text-xs" role="listitem"><span className="request-picker-dot request-picker-dot-green" />{t("calendarFerieApproved")}</span>
        <span className="text-xs" role="listitem"><span className="request-picker-dot request-picker-dot-yellow" />{t("calendarFeriePending")}</span>
        <span className="text-xs" role="listitem"><span className="request-picker-dot request-picker-dot-blue" />{t("calendarPermessoApproved")}</span>
        <span className="text-xs" role="listitem"><span className="request-picker-dot request-picker-dot-violet" />{t("calendarPermessoPending")}</span>
      </div>
    </div>
    {conflictMessage && <Alert className={cn("mt-3", toneSoft.red, toneBorder.red)}><AlertTriangleIcon /><AlertDescription className="text-current">{conflictMessage}</AlertDescription></Alert>}
    {(calendar.isError || selectionMetadataUnavailable) && <Alert className={cn("mt-3", toneSoft.orange, toneBorder.orange)}><AlertTriangleIcon /><AlertDescription className="text-current">{t("calendarUnavailable")}</AlertDescription></Alert>}
  </div>;
}
