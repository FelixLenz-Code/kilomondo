"use client";

import { useState, cloneElement, type ReactElement, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A list row that can flip from a read-only view into an inline edit form.
 * The page passes the read content as `children`, an optional right-aligned
 * `meta` node (e.g. a cost), the bound `edit` form element (which receives an
 * injected `onDone` to close itself on success) and the existing delete button.
 * When `edit` is omitted (viewers), the row stays read-only.
 */
export function EditableRow({
  children,
  meta,
  edit,
  deleteButton,
  align = "start",
}: {
  children: ReactNode;
  meta?: ReactNode;
  edit?: ReactElement<{ onDone?: () => void }>;
  deleteButton?: ReactNode;
  align?: "start" | "center";
}) {
  const [editing, setEditing] = useState(false);

  if (editing && edit) {
    return (
      <div className="rounded-lg border border-border/60 bg-background/40 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">Eintrag bearbeiten</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(false)}
            aria-label="Abbrechen"
          >
            <X className="size-4" />
          </Button>
        </div>
        {cloneElement(edit, { onDone: () => setEditing(false) })}
      </div>
    );
  }

  return (
    <div
      className={`flex ${
        align === "center" ? "items-center" : "items-start"
      } justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3`}
    >
      <div className="min-w-0">{children}</div>
      <div className="flex shrink-0 items-center gap-2">
        {meta}
        {edit && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}
            aria-label="Bearbeiten"
          >
            <Pencil className="size-4" />
          </Button>
        )}
        {deleteButton}
      </div>
    </div>
  );
}
