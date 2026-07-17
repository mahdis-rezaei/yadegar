import { useLocation } from "wouter";
import { AmbientField, SiteNav } from "@/components/site-chrome";

// The values behind Yadegar, stated plainly, in the product's own voice. Trust
// is the moat; this page is where the promises live. A calm reading page, same
// chrome as the maker's note.
const TENETS: { title: string; body: string }[] = [
  {
    title: "Your words belong to you.",
    body: "Everything you write is yours. We encrypt your pages, never sell them, never train on them, never show them to anyone. You can export everything, more easily than you imported it, or delete it entirely, at any time. Leaving is always easy; that's how you know it's safe to stay.",
  },
  {
    title: "Memory is not productivity.",
    body: "There are no streaks here. No badges, no \"days active,\" no guilt for the weeks you didn't write. A life isn't measured in consistency. The only number we keep is the one that accumulates: the pages you've kept, across the years of your life.",
  },
  {
    title: "Reflection matters more than optimization.",
    body: "Yadegar will not coach you, rate you, or tell you how to be better. It keeps your pages, and every so often brings one back, a thread, a forgotten page, a distance traveled, always pointing to your own words.",
  },
  {
    title: "AI never interprets your life.",
    body: "A model helps decide which of your own words to bring back, and it stays quiet when nothing honest surfaces. It never diagnoses you, never summarizes who you are, never explains what your life means. That is yours to know.",
  },
  {
    title: "The page has not changed. You have.",
    body: "That is the quiet magic of returning to old journals. The words stayed exactly where you left them; the person reading them grew. Yadegar exists to keep you in conversation with who you were, and who you're becoming.",
  },
];

export default function Philosophy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AmbientField />
      <SiteNav showWhy />

      <main className="flex-1 w-full max-w-[640px] mx-auto px-6 py-16 md:py-24">
        <header className="mb-16">
          <p className="font-sans text-xs uppercase tracking-[0.22em] text-faint-ink mb-5">
            What we believe
          </p>
          <h1 className="font-display text-5xl md:text-6xl text-deep-brown leading-tight">
            The Yadegar philosophy
          </h1>
        </header>

        <article className="space-y-14">
          {TENETS.map((t) => (
            <section key={t.title}>
              <h2 className="font-display text-2xl md:text-3xl text-deep-brown leading-snug mb-3">
                {t.title}
              </h2>
              <p className="font-body text-lg text-soft-ink leading-relaxed">
                {t.body}
              </p>
            </section>
          ))}
        </article>

        <div className="h-px bg-border my-14" />

        <p className="font-body italic text-xl text-soft-ink mb-10">
          Someone can switch journaling apps. But this is where your life lives.
        </p>

        <button
          onClick={() => setLocation("/why")}
          className="rounded-full bg-deep-brown text-background px-8 py-3 font-sans text-sm hover:bg-ink transition-colors"
        >
          Read why I built Yadegar →
        </button>
      </main>
    </div>
  );
}
