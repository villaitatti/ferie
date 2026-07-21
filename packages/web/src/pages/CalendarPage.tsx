import { Group, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type CalendarEntry } from "../api";

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const [scope, setScope] = useState<"personal" | "department">("department");
  const year = new Date().getFullYear();
  const calendar = useQuery({ queryKey: ["calendar", scope, year], queryFn: () => api<CalendarEntry[]>(`/calendars/${scope}?from=${year}-01-01&to=${year}-12-31`) });
  const events = calendar.data?.map((entry) => ({
    id: entry.id,
    title: `${scope === "department" ? `${entry.employeeName} · ` : ""}${i18n.language === "en" ? entry.typeLabelEn : entry.typeLabelIt}`,
    start: entry.startTime ? `${entry.startDate}T${entry.startTime}` : entry.startDate,
    end: entry.startTime ? `${entry.endDate}T${entry.endTime}` : dayjs(entry.endDate).add(1, "day").format("YYYY-MM-DD"),
    allDay: !entry.startTime,
    classNames: entry.sensitive ? ["event-sensitive"] : ["event-standard"],
  })) ?? [];
  return <Stack gap="lg"><Group justify="space-between" align="flex-end"><div><Text size="sm" c="dimmed">Europe/Rome</Text><Title order={1}>{t("calendar")}</Title></div><SegmentedControl value={scope} onChange={(value) => setScope(value as typeof scope)} data={[{ value: "personal", label: t("personal") }, { value: "department", label: t("department") }]} /></Group>
    <div className="calendar-shell"><FullCalendar plugins={[dayGridPlugin, listPlugin, interactionPlugin]} initialView="dayGridMonth" locale={i18n.language} events={events} height="auto" firstDay={1} headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,listMonth" }} buttonText={{ today: i18n.language === "en" ? "Today" : "Oggi", month: i18n.language === "en" ? "Month" : "Mese", list: i18n.language === "en" ? "List" : "Elenco" }} /></div>
  </Stack>;
}
