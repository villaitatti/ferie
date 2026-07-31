import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { FormField, fieldDescribedBy, fieldLabelId } from "@/components/ui/form-field";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxFieldProps {
  value: string | null;
  onChange: (value: string) => void;
  data: ComboboxOption[];
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  size?: "sm" | "default";
  id?: string;
  fieldClassName?: string;
}

/**
 * A filtering picker for the lists that are too long to scroll — the employee roster, the demo
 * identities. Base UI owns the filtering, so there is no separate command-palette dependency.
 */
function ComboboxField({
  value,
  onChange,
  data,
  label,
  description,
  error,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled,
  size = "default",
  id,
  fieldClassName,
}: ComboboxFieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const selected = data.find((option) => option.value === value) ?? null;

  return (
    <FormField id={fieldId} label={label} description={description} error={error} className={fieldClassName}>
      <Combobox
        items={data}
        value={selected}
        onValueChange={(next) => { if (next) onChange(next.value); }}
        itemToStringLabel={(option: ComboboxOption) => option.label}
        itemToStringValue={(option: ComboboxOption) => option.value}
        isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) => a.value === b.value}
        disabled={disabled}
      >
        <ComboboxTrigger
          render={
            <Button
              id={fieldId}
              type="button"
              variant="outline"
              aria-labelledby={label ? `${fieldLabelId(fieldId)} ${fieldId}` : undefined}
              aria-describedby={fieldDescribedBy(fieldId, description, error)}
              aria-invalid={error ? true : undefined}
              className={cn(
                "w-full justify-between bg-transparent font-normal",
                size === "sm" ? "h-8 text-xs" : "h-9",
                !selected && "text-muted-foreground",
              )}
            />
          }
        >
          <ComboboxValue placeholder={placeholder}>
            {(option: ComboboxOption | null) => <span className="truncate">{option?.label ?? placeholder}</span>}
          </ComboboxValue>
        </ComboboxTrigger>
        <ComboboxContent className="min-w-56">
          <ComboboxInput placeholder={searchPlaceholder ?? placeholder} showTrigger={false} />
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(option: ComboboxOption) => (
              <ComboboxItem key={option.value} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </FormField>
  );
}

export { ComboboxField };
