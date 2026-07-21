import { Alert, Group, Stack, Text, Tooltip } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import type { RequestCalendarDay, RequestCalendarMarker, RequestCalendarResponse, WorkInterval } from "@ferie/shared";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { findRequestConflict, formatPortalDate, formatPortalDateRange, formatPortalDateWithWeekday, isScheduledWorkday, toDateOnlyString } from "../request-calendar";

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

export function RequestDatePicker({ kind, startDate, endDate, schedule, revisionOfId, onChange }: RequestDatePickerProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const mobile = useMediaQuery("(max-width: 47.99em)");
  const [displayedDate, setDisplayedDate] = useState(startDate || Temporal.Now.plainDateISO("Europe/Rome").toString());
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

  const renderDay = (date: string) => {
    const day = daysByDate.get(date);
    const states = [...new Set<MarkerState>([
      ...(day?.holidays.length ? ["holiday" as const] : []),
      ...(day?.requests.map(requestMarkerState) ?? []),
    ])];
    const content = <span className="request-picker-day"><span>{Temporal.PlainDate.from(date).day}</span><span className="request-picker-dots">{states.map((state) => <span key={state} className={`request-picker-dot request-picker-dot-${statusColor[state]}`} />)}</span></span>;
    if (states.length === 0) return content;

    return <Tooltip
      label={<Stack gap={8}>
        <Text size="sm" fw={700}>{formatPortalDateWithWeekday(date, locale)}</Text>
        {(day?.holidays ?? []).map((holiday) => <Group key={holiday.code} gap="xs" wrap="nowrap" align="flex-start">
          <span className="request-picker-dot request-picker-dot-red request-picker-tooltip-marker" aria-hidden="true" />
          <div><Text size="xs" c="dimmed">{t("calendarHoliday")}</Text><Text size="sm" fw={600}>{locale === "en" ? holiday.labelEn : holiday.labelIt}</Text></div>
        </Group>)}
        {!isScheduledWorkday(date, schedule) && <Group gap="xs" wrap="nowrap">
          <span className="request-picker-non-working request-picker-tooltip-marker" aria-hidden="true" />
          <Text size="sm" fw={600}>{t("calendarNonWorking")}</Text>
        </Group>}
        {(day?.requests ?? []).map((request) => {
          const marker = requestMarkerState(request);
          const detail = locale === "en" ? request.labelEn : request.labelIt;
          const time = request.startTime && request.endTime ? ` · ${request.startTime}–${request.endTime}` : "";
          return <Group key={request.requestId} gap="xs" wrap="nowrap" align="flex-start">
            <span className={`request-picker-dot request-picker-dot-${statusColor[marker]} request-picker-tooltip-marker`} aria-hidden="true" />
            <div><Text size="xs" c="dimmed">{requestStatusLabel(request)}</Text><Text size="sm" fw={600}>{detail}{time}</Text></div>
          </Group>;
        })}
      </Stack>}
      classNames={{ tooltip: "request-picker-tooltip", arrow: "request-picker-tooltip-arrow" }}
      openDelay={120}
      closeDelay={50}
      offset={8}
      position="top"
      withArrow
      arrowSize={7}
      transitionProps={{ duration: 90, transition: "fade-up" }}
      events={{ hover: true, focus: false, touch: false }}
      multiline
    >
      {content}
    </Tooltip>;
  };

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
    if (await validateSelection(from, to)) onChange(from, to);
    else onChange(from, "");
  };

  const handleSingleChange = async (date: string | null) => {
    if (!date) {
      setConflictMessage(null);
      onChange("", "");
      return;
    }
    if (await validateSelection(date, date)) onChange(date, date);
  };

  const sharedProps = {
    leftSection: <CalendarDays size={17} />,
    locale,
    firstDayOfWeek: 1 as const,
    weekendDays: [0, 6] as Array<0 | 6>,
    dropdownType: mobile ? "modal" as const : "popover" as const,
    date: displayedDate,
    onDateChange: setDisplayedDate,
    renderDay,
    getDayProps: (date: string) => ({
      "data-non-working": !isScheduledWorkday(date, schedule) || undefined,
    }),
    getDayAriaLabel: (date: string) => dayLabel(date, daysByDate.get(date)),
    nextLabel: t("calendarNextMonth"),
    previousLabel: t("calendarPreviousMonth"),
    valueFormat: "DD MMMM YYYY",
    clearable: true,
  };

  const periodHelp = <span className="request-picker-help">
    <span>{t("calendarSingleDayPrefix")} <strong>{t("calendarSingleDayTerm")}</strong>{t("calendarSingleDaySuffix")}</span>
    <span>{t("calendarRangePrefix")} <strong>{t("calendarRangeTerm")}</strong>{t("calendarRangeSuffix")}</span>
  </span>;

  return <div className="request-date-picker">
    <div className="request-date-control">
      {kind === "FERIE" ? <DatePickerInput
      {...sharedProps}
      type="range"
      label={<Text component="span" className="request-picker-heading">{t("calendarPeriod")}</Text>}
      description={periodHelp}
      placeholder={t("calendarChoosePeriod")}
      value={[startDate || null, endDate || null]}
      valueFormatter={({ date, locale: formatterLocale, labelSeparator }) => Array.isArray(date)
        ? formatPortalDateRange(toDateOnlyString(date[0]), toDateOnlyString(date[1]), formatterLocale, labelSeparator)
        : ""}
      onChange={(value) => { void handleRangeChange(value); }}
      allowSingleDateInRange
    /> : <DatePickerInput
      {...sharedProps}
      label={t("startDate")}
      placeholder={t("calendarChooseDate")}
      value={startDate || null}
      onChange={(value) => { void handleSingleChange(value); }}
      excludeDate={(date) => !isScheduledWorkday(date, schedule) || Boolean(daysByDate.get(date)?.holidays.length)}
      />}
    </div>
    <div className="request-picker-legend-block">
      <Text size="xs" fw={600} c="dimmed">{t("calendarLegend")}</Text>
      <div className="request-picker-legend" role="list" aria-label={t("calendarLegend")}>
        <Text size="xs" role="listitem"><span className="request-picker-dot request-picker-dot-red" />{t("calendarHoliday")}</Text>
        <Text size="xs" role="listitem"><span className="request-picker-non-working" />{t("calendarNonWorking")}</Text>
        <Text size="xs" role="listitem"><span className="request-picker-dot request-picker-dot-green" />{t("calendarFerieApproved")}</Text>
        <Text size="xs" role="listitem"><span className="request-picker-dot request-picker-dot-yellow" />{t("calendarFeriePending")}</Text>
        <Text size="xs" role="listitem"><span className="request-picker-dot request-picker-dot-blue" />{t("calendarPermessoApproved")}</Text>
        <Text size="xs" role="listitem"><span className="request-picker-dot request-picker-dot-violet" />{t("calendarPermessoPending")}</Text>
      </div>
    </div>
    {conflictMessage && <Alert mt="sm" color="red" icon={<AlertTriangle size={17} />}>{conflictMessage}</Alert>}
    {(calendar.isError || selectionMetadataUnavailable) && <Alert mt="sm" color="orange" icon={<AlertTriangle size={17} />}>{t("calendarUnavailable")}</Alert>}
  </div>;
}
