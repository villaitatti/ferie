import * as React from "react";
import { CalendarDaysIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { calendarLocale, toDate, toDateOrNull, toIsoDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FormField, fieldDescribedBy, fieldLabelId } from "@/components/ui/form-field";
import { PickerSurface } from "@/components/ui/picker-surface";
import { formatPortalDate } from "@/request-calendar";

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  clearable?: boolean;
  disabled?: boolean;
  id?: string;
  fieldClassName?: string;
}

/** A single calendar day, on the same picker surface as the request picker. */
function DateField({
  value,
  onChange,
  label,
  description,
  error,
  placeholder,
  minDate,
  maxDate,
  clearable = false,
  disabled,
  id,
  fieldClassName,
}: DateFieldProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(() => toDate(value || toIsoDate(new Date())));
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;

  React.useEffect(() => { if (value) setMonth(toDate(value)); }, [value]);

  return (
    <FormField id={fieldId} label={label} description={description} error={error} className={fieldClassName}>
      <div className="relative">
        <PickerSurface
          open={open}
          onOpenChange={setOpen}
          title={label ?? placeholder}
          trigger={
            <Button
              id={fieldId}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-labelledby={label ? `${fieldLabelId(fieldId)} ${fieldId}` : undefined}
              aria-describedby={fieldDescribedBy(fieldId, description, error)}
              aria-invalid={error ? true : undefined}
              className={cn("w-full justify-start gap-2 bg-transparent font-normal", clearable && value && "pr-9", !value && "text-muted-foreground")}
            >
              <CalendarDaysIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{value ? formatPortalDate(value, i18n.language) : placeholder}</span>
            </Button>
          }
        >
          <Calendar
            mode="single"
            required={false}
            selected={toDateOrNull(value)}
            onSelect={(date) => {
              if (!date) return;
              onChange(toIsoDate(date));
              setOpen(false);
            }}
            month={month}
            onMonthChange={setMonth}
            locale={calendarLocale(i18n.language)}
            weekStartsOn={1}
            captionLayout="dropdown"
            startMonth={new Date(new Date().getFullYear() - 5, 0)}
            endMonth={new Date(new Date().getFullYear() + 5, 11)}
            disabled={[
              ...(minDate ? [{ before: toDate(minDate) }] : []),
              ...(maxDate ? [{ after: toDate(maxDate) }] : []),
            ]}
            labels={{
              labelNext: () => t("calendarNextMonth"),
              labelPrevious: () => t("calendarPreviousMonth"),
            }}
            className="p-3"
          />
        </PickerSurface>
        {clearable && value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("calendarClear")}
            onClick={() => onChange("")}
            className="absolute top-0.5 right-0.5 text-muted-foreground"
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
    </FormField>
  );
}

export { DateField };
