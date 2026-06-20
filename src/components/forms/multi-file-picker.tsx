"use client";

import { useRef, useState } from "react";
import { FileUp, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Picked = { dataUrl: string; name: string };
export type ExistingAttachment = { id: string; fileName: string };

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = "application/pdf,image/*";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * Lets the user attach files (PDF invoices/reports, images of receipts) to an
 * entry. New files are read as data-URLs and posted as parallel hidden inputs
 * (`name` + `${name}Names`). On edit, existing attachments are shown and the
 * ids to keep are posted as `keep${Name}` so the server can delete the rest.
 */
export function MultiFilePicker({
  name,
  label,
  existing = [],
}: {
  name: string;
  label: string;
  existing?: ExistingAttachment[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<Picked[]>([]);
  const [kept, setKept] = useState<ExistingAttachment[]>(existing);
  const keepField = `keep${name.charAt(0).toUpperCase()}${name.slice(1)}`;

  async function onFiles(list: FileList) {
    setBusy(true);
    try {
      const picked: Picked[] = [];
      for (const file of Array.from(list)) {
        if (file.size > MAX_BYTES) continue;
        picked.push({ dataUrl: await readAsDataUrl(file), name: file.name });
      }
      setFiles((prev) => [...prev, ...picked]);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {kept.map((a) => (
        <input key={a.id} type="hidden" name={keepField} value={a.id} />
      ))}
      {files.map((f, i) => (
        <span key={i}>
          <input type="hidden" name={name} value={f.dataUrl} />
          <input type="hidden" name={`${name}Names`} value={f.name} />
        </span>
      ))}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void onFiles(e.target.files);
        }}
      />

      {(kept.length > 0 || files.length > 0) && (
        <ul className="space-y-1">
          {kept.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <a
                href={`/api/attachments/${a.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate hover:underline"
              >
                {a.fileName}
              </a>
              <button
                type="button"
                onClick={() => setKept((p) => p.filter((x) => x.id !== a.id))}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Entfernen"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Entfernen"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="animate-spin" />
        ) : (
          <>
            <FileUp className="mr-2 size-4" />
            Datei anhängen (PDF, Bild)
          </>
        )}
      </Button>
    </div>
  );
}
