import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, "aria-label": ariaLabel, ...props }: React.ComponentProps<"svg">) {
  return (
    // Local fix: the registry hardcodes `aria-label="Loading"`, which is wrong in a bilingual app.
    // Every current use sits beside visible text, so the icon defaults to decorative; a standalone
    // spinner announces itself by passing its own translated `aria-label`.
    <Loader2Icon
      data-slot="spinner"
      role={ariaLabel ? "status" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
