"use client";

import { useState } from "react";
import { Check, Loader2, NotebookPen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type SetEntry = {
  exerciseLogId: string | null;
  reps: string;
  notes: string;
  status: "idle" | "saving" | "saved" | "error";
};

/**
 * Strips anything that isn't a digit — reps must be a non-negative
 * integer, so this rejects "-", ".", "e", pasted text, etc. rather than
 * letting an invalid value sit in the field until save.
 */
function sanitizeRepsInput(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

export function SetRow({
  setNumber,
  entry,
  onRepsChange,
  onNotesChange,
  onSave,
}: {
  setNumber: number;
  entry: SetEntry;
  onRepsChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSave: () => void;
}) {
  const [notesOpen, setNotesOpen] = useState(entry.notes.trim() !== "");

  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-sm font-medium text-muted-foreground">
          Set {setNumber}
        </span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="reps"
          aria-label={`Reps completed for set ${setNumber}`}
          className="h-11 flex-1 text-base"
          value={entry.reps}
          onChange={(event) =>
            onRepsChange(sanitizeRepsInput(event.target.value))
          }
          onBlur={onSave}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => setNotesOpen((open) => !open)}
          aria-label="Toggle note for this set"
        >
          <NotebookPen className="size-4" />
        </Button>
        <span className="flex w-5 shrink-0 items-center justify-center">
          {entry.status === "saving" && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          {entry.status === "saved" && (
            <Check className="size-4 text-primary" />
          )}
          {entry.status === "error" && (
            <span className="text-xs font-semibold text-destructive">!</span>
          )}
        </span>
      </div>
      {notesOpen && (
        <Input
          type="text"
          placeholder="Note (optional)"
          aria-label={`Note for set ${setNumber}`}
          className="h-10 text-sm"
          value={entry.notes}
          onChange={(event) => onNotesChange(event.target.value)}
          onBlur={onSave}
        />
      )}
    </div>
  );
}
