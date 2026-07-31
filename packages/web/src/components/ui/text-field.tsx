import * as React from "react";

import { FormField, fieldDescribedBy } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SharedProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  fieldClassName?: string;
}

function TextField({ label, description, error, fieldClassName, id, ...props }: SharedProps & React.ComponentProps<"input">) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  return (
    <FormField id={fieldId} label={label} description={description} error={error} className={fieldClassName}>
      <Input id={fieldId} aria-describedby={fieldDescribedBy(fieldId, description, error)} aria-invalid={error ? true : undefined} {...props} />
    </FormField>
  );
}

function TextareaField({ label, description, error, fieldClassName, id, ...props }: SharedProps & React.ComponentProps<"textarea">) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  return (
    <FormField id={fieldId} label={label} description={description} error={error} className={fieldClassName}>
      <Textarea id={fieldId} aria-describedby={fieldDescribedBy(fieldId, description, error)} aria-invalid={error ? true : undefined} {...props} />
    </FormField>
  );
}

export { TextField, TextareaField };
