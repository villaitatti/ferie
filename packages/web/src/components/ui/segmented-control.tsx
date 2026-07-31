import * as React from "react";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

export interface SegmentedControlItem {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  data: SegmentedControlItem[];
  fullWidth?: boolean;
  size?: "sm" | "default";
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * A single-choice control that reads as one object rather than a row of buttons.
 *
 * Built on the radio group rather than the toggle group: these choices are mutually exclusive and
 * always one of N, which is `radiogroup` semantics — a toggle group would announce a row of
 * independent pressed buttons. The primitives are used directly rather than through the styled
 * `radio-group` wrapper, whose segment is a 16px dot with its own indicator.
 */
function SegmentedControl({
  value,
  onChange,
  data,
  fullWidth = false,
  size = "default",
  disabled,
  className,
  ...props
}: SegmentedControlProps) {
  return (
    <RadioGroupPrimitive
      value={value}
      onValueChange={(next) => { if (typeof next === "string") onChange(next); }}
      disabled={disabled}
      data-slot="segmented-control"
      className={cn(
        "inline-flex items-stretch gap-1 rounded-md border border-border bg-muted p-1 text-muted-foreground",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {data.map((item) => (
        <RadioPrimitive.Root
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          data-slot="segmented-control-item"
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-sm border-0 bg-transparent px-3 font-medium whitespace-nowrap transition-all outline-none select-none",
            "hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
            "data-checked:bg-card data-checked:text-foreground data-checked:shadow-xs",
            size === "sm" ? "h-7 text-xs" : "h-8 text-sm",
            fullWidth ? "flex-1" : "flex-none",
          )}
        >
          {item.label}
        </RadioPrimitive.Root>
      ))}
    </RadioGroupPrimitive>
  );
}

export { SegmentedControl };
