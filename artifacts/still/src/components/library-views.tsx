import { Link } from "wouter";

// Ways to view the Library, the same pages, different lenses. List is the
// default; Calendar jumps to a date; Timeline shows the sweep. Search isn't here:
// it's the Library's own search box (search is a function, not a view).
const VIEWS = [
  { href: "/library", key: "list", label: "List" },
  { href: "/calendar", key: "calendar", label: "Calendar" },
  { href: "/timeline", key: "timeline", label: "Timeline" },
];

export function LibraryViews({
  current,
}: {
  current: "list" | "calendar" | "timeline";
}) {
  return (
    <div className="flex items-center gap-5 -mt-2 mb-8">
      {VIEWS.map((v) => (
        <Link
          key={v.key}
          href={v.href}
          className={
            "font-sans text-sm transition-colors " +
            (v.key === current ? "text-ink" : "text-soft-ink hover:text-ink")
          }
          data-testid={`library-view-${v.key}`}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
