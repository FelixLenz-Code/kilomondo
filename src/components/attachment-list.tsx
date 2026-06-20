import { FileText } from "lucide-react";

/** Read-only list of an entry's attachments, each a link to the file route. */
export function AttachmentList({
  attachments,
}: {
  attachments: { id: string; fileName: string }[];
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) => (
        <a
          key={a.id}
          href={`/api/attachments/${a.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title={`${a.fileName} öffnen`}
        >
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">{a.fileName}</span>
        </a>
      ))}
    </div>
  );
}
