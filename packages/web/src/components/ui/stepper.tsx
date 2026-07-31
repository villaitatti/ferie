import * as React from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StepperProps extends React.ComponentProps<"ol"> {
  active: number;
  steps: string[];
}

/** Shows how far along a request is. Purely informative: the steps are not clickable. */
function Stepper({ active, steps, className, ...props }: StepperProps) {
  return (
    <ol data-slot="stepper" className={cn("flex w-full items-start", className)} {...props}>
      {steps.map((step, index) => {
        const done = index < active;
        const current = index === active;
        return (
          <li
            key={step}
            aria-current={current ? "step" : undefined}
            className={cn("flex min-w-0 items-start gap-3", index < steps.length - 1 && "flex-1")}
          >
            <div className="flex min-w-0 flex-col items-center gap-1.5 sm:flex-row sm:gap-2.5">
              <span
                data-state={done ? "done" : current ? "current" : "todo"}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary bg-card text-primary",
                  !done && !current && "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate text-center text-xs sm:text-left sm:text-sm",
                  current || done ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className={cn("mt-3.5 h-px min-w-4 flex-1", done ? "bg-primary" : "bg-border")} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export { Stepper };
