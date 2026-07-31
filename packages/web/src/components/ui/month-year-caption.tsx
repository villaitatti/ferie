import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type CaptionLabelProps, useDayPicker } from "react-day-picker";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The caption doubles as a jump control: clicking "November 2026" opens a month and year grid, which
 * is how the picker has always let you move a year out without paging twelve times. Keeping it a
 * single label preserves the caption text screen readers announce.
 */
function MonthYearCaption({ children, className, ...props }: CaptionLabelProps) {
  const { t, i18n } = useTranslation();
  const { months, goToMonth } = useDayPicker();
  const [open, setOpen] = React.useState(false);
  const displayed = months.at(0)?.date ?? new Date();
  const [year, setYear] = React.useState(displayed.getFullYear());

  React.useEffect(() => { if (open) setYear(displayed.getFullYear()); }, [open, displayed]);

  const monthNames = React.useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language === "en" ? "en-GB" : "it-IT", { month: "short" });
    return Array.from({ length: 12 }, (_, month) => formatter.format(new Date(2000, month, 1)));
  }, [i18n.language]);

  return (
    <span aria-live="polite" className={cn("inline-flex", className)} {...props}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-sm font-medium capitalize" />}
        >
          {children}
          <ChevronDownIcon className="size-3.5 opacity-60" />
        </PopoverTrigger>
        <PopoverContent align="center" className="w-64 p-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon-sm" aria-label={t("calendarPreviousYear")} onClick={() => setYear(year - 1)}>
              <ChevronLeftIcon />
            </Button>
            <span className="text-sm font-semibold tabular-nums">{year}</span>
            <Button variant="ghost" size="icon-sm" aria-label={t("calendarNextYear")} onClick={() => setYear(year + 1)}>
              <ChevronRightIcon />
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {monthNames.map((name, month) => {
              const active = displayed.getFullYear() === year && displayed.getMonth() === month;
              return (
                <Button
                  key={name}
                  variant={active ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-1 text-xs capitalize"
                  onClick={() => { goToMonth(new Date(year, month, 1)); setOpen(false); }}
                >
                  {name}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}

export { MonthYearCaption };
