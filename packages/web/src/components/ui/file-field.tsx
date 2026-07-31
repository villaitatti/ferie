import * as React from "react";
import { PaperclipIcon, UploadIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormField, fieldDescribedBy, fieldLabelId } from "@/components/ui/form-field";

interface FileFieldProps {
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  placeholder?: string;
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
  fieldClassName?: string;
}

/**
 * The browser's file input is the least stylable control there is, so the real one is hidden and this
 * shadcn surface drives it. Drag-and-drop is supported because a spreadsheet is usually dragged in.
 */
function FileField({
  value,
  onChange,
  accept,
  label,
  description,
  error,
  placeholder,
  clearLabel = "Clear file",
  disabled,
  id,
  fieldClassName,
}: FileFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;

  const pick = () => inputRef.current?.click();

  return (
    <FormField id={fieldId} label={label} description={description} error={error} className={fieldClassName}>
      <div
        data-slot="file-field"
        data-dragging={dragging || undefined}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const [file] = Array.from(event.dataTransfer.files);
          if (file && !disabled) onChange(file);
        }}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent pr-1 pl-3 shadow-xs transition-[color,box-shadow]",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          "data-[dragging]:border-primary data-[dragging]:bg-accent",
          disabled && "pointer-events-none opacity-50",
          error && "border-destructive",
        )}
      >
        <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
        <button
          id={fieldId}
          type="button"
          disabled={disabled}
          onClick={pick}
          aria-labelledby={label ? `${fieldLabelId(fieldId)} ${fieldId}` : undefined}
          aria-describedby={fieldDescribedBy(fieldId, description, error)}
          aria-invalid={error ? true : undefined}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm outline-none",
            !value && "text-muted-foreground",
          )}
        >
          {value?.name ?? placeholder}
        </button>
        {value ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={clearLabel} onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ""; }}>
            <XIcon />
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="icon-sm" tabIndex={-1} aria-hidden="true" onClick={pick}>
            <UploadIcon />
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
          onChange={(event) => onChange(event.currentTarget.files?.[0] ?? null)}
        />
      </div>
    </FormField>
  );
}

export { FileField };
