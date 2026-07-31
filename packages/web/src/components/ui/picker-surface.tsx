import * as React from "react";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-media-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PickerSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  title: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * A dropdown on a pointer device and a centred sheet on a phone, which is the only way a month grid
 * stays legible on a narrow screen. Mirrors what `dropdownType` did for the Mantine pickers.
 */
function PickerSurface({ open, onOpenChange, trigger, title, children, align = "start", className }: PickerSurfaceProps) {
  const mobile = useIsMobile();

  if (mobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger render={trigger} />
        {/* Bounded to the viewport with internal scrolling: a phone in landscape is shorter than the
            month grid, and the dialog locks body scroll, so an unbounded panel would be clipped with
            no way to reach the close button. */}
        <DialogContent className={cn("max-h-[calc(100dvh-1rem)] w-auto max-w-[calc(100vw-1.5rem)] gap-3 overflow-y-auto p-4", className)}>
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align={align} className={cn("w-auto p-0", className)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

export { PickerSurface };
