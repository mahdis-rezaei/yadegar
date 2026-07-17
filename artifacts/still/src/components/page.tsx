// Shared page header for the signed-in app, so every screen opens the same way:
// a large serif title, an optional quiet subtitle, and optional right-aligned
// actions. Keeps Today / Library / Returns / Settings / Import visually one.
export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div className="min-w-0">
        <h1 className="font-display text-4xl text-deep-brown">{title}</h1>
        {subtitle && (
          <p className="font-body text-soft-ink mt-2 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
