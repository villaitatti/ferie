import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Wired straight to the design tokens, which carry both themes, so no theme prop is needed. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      richColors
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--tone-green-soft)",
          "--success-text": "var(--tone-green)",
          "--success-border": "var(--tone-green)",
          "--error-bg": "var(--tone-red-soft)",
          "--error-text": "var(--tone-red)",
          "--error-border": "var(--tone-red)",
          "--warning-bg": "var(--tone-orange-soft)",
          "--warning-text": "var(--tone-orange)",
          "--warning-border": "var(--tone-orange)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "font-sans text-sm shadow-lg",
          description: "text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
