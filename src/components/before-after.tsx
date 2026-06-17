function Gallery({ ids, label }: { ids: string[]; label: string }) {
  if (ids.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <a
            key={id}
            href={`/api/images/${id}`}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-md border border-border"
            title={`${label} öffnen`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/images/${id}`}
              alt={label}
              className="h-20 w-28 object-cover transition-transform hover:scale-105"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export function BeforeAfter({
  before,
  after,
}: {
  before: string[];
  after: string[];
}) {
  if (before.length === 0 && after.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-4">
      <Gallery ids={before} label="Vorher" />
      <Gallery ids={after} label="Nachher" />
    </div>
  );
}
