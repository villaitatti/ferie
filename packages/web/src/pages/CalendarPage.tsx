import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { addDays, format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type CalendarEntry } from "../api";
import { PageHeading } from "../components";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { SegmentedControl } from "@/components/ui/segmented-control";

type Scope = "personal" | "department";
type View = "dayGridMonth" | "listMonth";

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const [scope, setScope] = useState<Scope>("department");
  const [view, setView] = useState<View>("dayGridMonth");
  const [title, setTitle] = useState("");
  const calendarRef = useRef<FullCalendar>(null);
  const year = new Date().getFullYear();
  const calendar = useQuery({ queryKey: ["calendar", scope, year], queryFn: () => api<CalendarEntry[]>(`/calendars/${scope}?from=${year}-01-01&to=${year}-12-31`) });
  const events = calendar.data?.map((entry) => ({
    id: entry.id,
    title: `${scope === "department" ? `${entry.employeeName} · ` : ""}${i18n.language === "en" ? entry.typeLabelEn : entry.typeLabelIt}`,
    start: entry.startTime ? `${entry.startDate}T${entry.startTime}` : entry.startDate,
    end: entry.startTime ? `${entry.endDate}T${entry.endTime}` : format(addDays(new Date(`${entry.endDate}T00:00:00`), 1), "yyyy-MM-dd"),
    allDay: !entry.startTime,
    classNames: entry.sensitive ? ["event-sensitive"] : ["event-standard"],
  })) ?? [];

  const move = (direction: "prev" | "next" | "today") => calendarRef.current?.getApi()[direction]();
  const changeView = (next: View) => { setView(next); calendarRef.current?.getApi().changeView(next); };

  return <div className="flex flex-col gap-5">
    <PageHeading eyebrow="Europe/Rome" title={t("calendar")}>
      <SegmentedControl
        value={scope}
        onChange={(value) => setScope(value as Scope)}
        aria-label={t("calendar")}
        data={[{ value: "personal", label: t("personal") }, { value: "department", label: t("department") }]}
      />
    </PageHeading>

    {/* FullCalendar's own toolbar is replaced so navigation uses the same buttons as the rest of the portal. */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <ButtonGroup>
          <Button variant="outline" size="icon" aria-label={t("calendarPreviousMonth")} onClick={() => move("prev")}><ChevronLeftIcon /></Button>
          <Button variant="outline" size="icon" aria-label={t("calendarNextMonth")} onClick={() => move("next")}><ChevronRightIcon /></Button>
        </ButtonGroup>
        <Button variant="outline" onClick={() => move("today")}>{i18n.language === "en" ? "Today" : "Oggi"}</Button>
      </div>
      <p className="order-first w-full text-lg font-semibold first-letter:uppercase sm:order-none sm:w-auto">{title}</p>
      <SegmentedControl
        value={view}
        onChange={(value) => changeView(value as View)}
        size="sm"
        aria-label={i18n.language === "en" ? "Calendar view" : "Vista del calendario"}
        data={[
          { value: "dayGridMonth", label: i18n.language === "en" ? "Month" : "Mese" },
          { value: "listMonth", label: i18n.language === "en" ? "List" : "Elenco" },
        ]}
      />
    </div>

    <div className="calendar-shell">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={i18n.language}
        events={events}
        height="auto"
        firstDay={1}
        headerToolbar={false}
        datesSet={(argument) => setTitle(argument.view.title)}
      />
    </div>
  </div>;
}
