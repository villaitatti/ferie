import * as React from "react";

import { cn } from "@/lib/utils";
import { FormField, fieldDescribedBy, fieldLabelId } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SelectOption = string | { value: string; label: string; disabled?: boolean };

interface SelectFieldProps {
  value: string | null;
  onChange: (value: string) => void;
  data: SelectOption[];
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "default";
  id?: string;
  className?: string;
  fieldClassName?: string;
  "aria-label"?: string;
}

function normalize(option: SelectOption) {
  return typeof option === "string" ? { value: option, label: option, disabled: false } : option;
}

/** The one dropdown in the portal. There is no `<select>` anywhere: this is Base UI all the way down. */
function SelectField({
  value,
  onChange,
  data,
  label,
  description,
  error,
  placeholder,
  disabled,
  size = "default",
  id,
  className,
  fieldClassName,
  ...props
}: SelectFieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const options = data.map(normalize);

  return (
    <FormField id={fieldId} label={label} description={description} error={error} className={fieldClassName}>
      {/* `items` is what lets the closed trigger show the option's label — without it Base UI falls
          back to the raw value, because the option elements are unmounted while the popup is shut. */}
      <Select items={options} value={value ?? null} onValueChange={(next) => { if (typeof next === "string") onChange(next); }} disabled={disabled}>
        {/* The trigger's own id joins the label's so the accessible name keeps the selected value. */}
        <SelectTrigger id={fieldId} size={size} aria-labelledby={label ? `${fieldLabelId(fieldId)} ${fieldId}` : undefined} aria-describedby={fieldDescribedBy(fieldId, description, error)} aria-invalid={error ? true : undefined} className={cn("w-full", className)} {...props}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

export { SelectField };
