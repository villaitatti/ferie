import * as React from "react";
import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { FormField, fieldDescribedBy } from "@/components/ui/form-field";

interface NumberFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  min?: number;
  max?: number;
  step?: number;
  decimalScale?: number;
  suffix?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * The browser's own spinner is unstyleable and differs per platform, so the buttons here are real
 * ones. Base UI owns the parsing, clamping and locale handling, which is why a partial entry such as
 * `1.` no longer needs to be modelled as a string the way it did before.
 */
function NumberField({
  value,
  onChange,
  label,
  description,
  error,
  min,
  max,
  step = 1,
  decimalScale = 2,
  suffix,
  disabled,
  id,
  className,
  ...props
}: NumberFieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;

  return (
    <FormField id={fieldId} label={label} description={description} error={error} className={className}>
      <NumberFieldPrimitive.Root
        id={fieldId}
        value={value}
        onValueChange={onChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        format={{ maximumFractionDigits: decimalScale }}
        data-slot="number-field"
        className="w-full"
      >
        <NumberFieldPrimitive.Group
          className={cn(
            "flex h-9 w-full items-stretch rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow]",
            "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
            "data-disabled:pointer-events-none data-disabled:opacity-50",
            error && "border-destructive ring-destructive/20",
          )}
        >
          <NumberFieldPrimitive.Input
            aria-describedby={fieldDescribedBy(fieldId, description, error)}
            aria-invalid={error ? true : undefined}
            className="w-full min-w-0 bg-transparent px-3 text-base outline-none md:text-sm"
            {...props}
          />
          {suffix ? <span className="flex items-center pr-1 text-sm text-muted-foreground select-none">{suffix}</span> : null}
          <div className="flex w-7 shrink-0 flex-col border-l border-input">
            <NumberFieldPrimitive.Increment
              tabIndex={-1}
              aria-hidden="true"
              className="flex flex-1 items-center justify-center rounded-tr-[calc(var(--radius)-1px)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none"
            >
              <ChevronUpIcon className="size-3" />
            </NumberFieldPrimitive.Increment>
            <NumberFieldPrimitive.Decrement
              tabIndex={-1}
              aria-hidden="true"
              className="flex flex-1 items-center justify-center rounded-br-[calc(var(--radius)-1px)] border-t border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none"
            >
              <ChevronDownIcon className="size-3" />
            </NumberFieldPrimitive.Decrement>
          </div>
        </NumberFieldPrimitive.Group>
      </NumberFieldPrimitive.Root>
    </FormField>
  );
}

export { NumberField };
