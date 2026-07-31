import * as React from "react";

import { cn } from "@/lib/utils";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

export interface FormFieldProps {
  id?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * The id of a field's label element. Several controls in the portal are buttons that open a panel —
 * the date pickers, the comboboxes, the file field — and a `<label for>` does not name a button in the
 * accessibility tree, only a form element. Those controls point at the label with `aria-labelledby`
 * instead, so the visible label is what a screen reader announces.
 */
export function fieldLabelId(id: string): string {
  return `${id}-label`;
}

/**
 * The `aria-describedby` value a field's control should carry, so the help text is read on focus and
 * the error is read as soon as focus lands on the control that caused it — `role="alert"` alone only
 * announces the error the moment it appears.
 */
export function fieldDescribedBy(id: string, description: React.ReactNode, error: React.ReactNode): string | undefined {
  const ids = [description ? `${id}-description` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

/**
 * Label, help text, control and error in the order the portal has always used: the help sits under
 * the label so it is read before the control is touched, not after a mistake has been made.
 */
function FormField({ id, label, description, error, className, children }: FormFieldProps) {
  return (
    <Field className={cn("gap-2", className)} data-invalid={error ? true : undefined}>
      {label ? <FieldLabel id={id ? fieldLabelId(id) : undefined} htmlFor={id}>{label}</FieldLabel> : null}
      {description ? <FieldDescription id={id ? `${id}-description` : undefined} className="mt-0">{description}</FieldDescription> : null}
      {children}
      {error ? <FieldError id={id ? `${id}-error` : undefined}>{error}</FieldError> : null}
    </Field>
  );
}

export { FormField };
