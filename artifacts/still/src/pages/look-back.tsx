import { Link, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AppNav } from "@/components/app-nav";
import { WhatKeepsReturning } from "@/components/what-keeps-returning";
import { RevisitATime } from "@/components/revisit-a-time";
import { ThenAndNow } from "@/components/then-and-now";
import { AForgottenPage } from "@/components/a-forgotten-page";
import { YearInPagesTab } from "@/components/year-in-pages-tab";
import { ReturnsLeftNote } from "@/components/returns-left-note";
import { useLookBack } from "@/lib/use-look-back";

// Look back, three ways your past returns to you, each its own route + page
// (the sub-tab bar lives in AppNav, mirroring Explore). Grouped by who drives it:
//   • What keeps returning, Yadegar brings you something (a thread, or a
//     forgotten page)
//   • Revisit a time, you pick a moment (read it back + the pages, and how far
//     you've come)
//   • Your Year in Pages, the keepsake you make
type Lens = "returning" | "revisit" | "keepsake";

export default function LookBack() {
  const queryClient = useQueryClient();
  const { data } = useLookBack();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["look-back"] });
  const forgotten = data?.forgotten ?? [];

  const [, params] = useRoute("/look-back/:lens");
  const lens: Lens =
    params?.lens === "revisit"
      ? "revisit"
      : params?.lens === "keepsake"
        ? "keepsake"
        : "returning";

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />

      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        {/* Near-limit cue — shown only when low + enforced (see component). The
            Look back lenses run the engine, so the gentle priming belongs here. */}
        <ReturnsLeftNote />
        {lens === "returning" && (
          <Lens
            title="What keeps returning"
            lead="Across years of pages, the same things quietly resurface, a worry, a hope, a line you keep coming back to without noticing. Yadegar reads your whole archive and brings back one thread worth sitting with."
          >
            <WhatKeepsReturning />

            <section className="mt-12 pt-8 border-t border-border/40">
              <h2 className="font-display text-2xl text-deep-brown mb-1">
                A page you'd forgotten
              </h2>
              <p className="font-body text-soft-ink mb-4 leading-relaxed">
                Or let an old page find you, one that's slipped out of view,
                read back in Yadegar's voice.
              </p>
              <AForgottenPage forgotten={forgotten} onChanged={refresh} />
            </section>

            <div className="mt-12 pt-6 border-t border-border/40">
              <Link
                href="/returns"
                className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
                data-testid="link-returns"
              >
                Everything Yadegar has brought back is kept in your Returns →
              </Link>
            </div>
          </Lens>
        )}

        {lens === "revisit" && (
          <Lens
            title="Revisit a time"
            lead="Pick a month and year, and Yadegar reads that stretch of your life back to you in your own words, then lays out the pages so you can read them again. A way to return somewhere on purpose."
          >
            <RevisitATime />

            <section className="mt-12 pt-8 border-t border-border/40">
              <h2 className="font-display text-2xl text-deep-brown mb-1">
                How far you've come
              </h2>
              <p className="font-body text-soft-ink mb-4 leading-relaxed">
                Or choose a past year, and Yadegar holds it up against where you
                are now, the distance you've travelled since.
              </p>
              <ThenAndNow />
            </section>
          </Lens>
        )}

        {lens === "keepsake" && (
          <Lens
            title="Your Year in Pages"
            lead="A whole year of your writing, gathered into one place, to read straight through, print, or keep as a book. The keepsake at the heart of Yadegar."
          >
            <YearInPagesTab />
          </Lens>
        )}
      </main>
    </div>
  );
}

// One lens page: a quiet "Look back" eyebrow, a large title that changes per
// lens (so each route reads as its own page), a real intro that explains what
// it does, then the lens content.
function Lens({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink">
        Look back
      </span>
      <h1 className="font-display text-3xl md:text-4xl text-deep-brown mt-2">
        {title}
      </h1>
      <p className="font-body text-soft-ink mt-3 mb-8 leading-relaxed max-w-[52ch]">
        {lead}
      </p>
      {children}
    </div>
  );
}
