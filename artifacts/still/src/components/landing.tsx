import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { AmbientField } from "@/components/site-chrome";
import { PricingCards } from "@/components/pricing-cards";
import { AppDownloadCTA } from "@/components/app-download";

// The public landing, an editorial scroll that lets someone *feel* Yadegar
// before they understand it. Type-led, warm paper, restrained color (soft
// tinted lens chips), the Persian word as a hero element. No stock photography.

type Tone = "sepia" | "sage" | "blush";

const TONES: Record<Tone, { backgroundColor: string; color: string }> = {
  sepia: { backgroundColor: "rgba(138,111,77,0.13)", color: "#8A6F4D" },
  sage: { backgroundColor: "rgba(120,134,102,0.16)", color: "#5e6a4d" },
  blush: { backgroundColor: "rgba(185,138,120,0.16)", color: "#9c6a58" },
};

// Example "returns", FICTIONAL, illustrative of the kind of pages Yadegar
// surfaces (one quiet line, in the writer's own words). Deliberately invented,
// never a real user's writing, since they show on the public landing page.
const RETURNS: {
  tag: string;
  tone: Tone;
  date: string;
  quote: string;
  note: string;
}[] = [
  {
    tag: "a forgotten page",
    tone: "sepia",
    date: "March 2017",
    quote:
      "Couldn't sleep, so I sat on the fire escape and watched the city not need me at all. It was strangely kind.",
    note: "A page you'd forgotten you wrote.",
  },
  {
    tag: "what kept returning",
    tone: "sage",
    date: "2014 to 2024",
    quote: "One more week, then I'll really begin.",
    note: "The same gentle promise, made to yourself for ten years.",
  },
  {
    tag: "how far you've come",
    tone: "blush",
    date: "2019 to today",
    quote: "I don't think I'll ever feel at home in this city.",
    note: "Years on, you simply stopped writing this.",
  },
  {
    tag: "something you knew",
    tone: "sepia",
    date: "August 2016",
    quote:
      "Ready was never going to be a feeling. It's a door you walk through scared.",
    note: "A line you wrote years ago that still holds.",
  },
  {
    tag: "a question you carried",
    tone: "sage",
    date: "2015 to 2025",
    quote: "Am I doing enough? Am I enough?",
    note: "The same question, ten years on, asked more gently.",
  },
  {
    tag: "the words you saved",
    tone: "blush",
    date: "2018",
    quote: "The wound is the place where the Light enters you. (Rumi)",
    note: "A line you copied down, back when it first found you.",
  },
  {
    tag: "a bright day",
    tone: "sepia",
    date: "July 2021",
    quote:
      "We danced in the kitchen until the rice burned. I want to keep this exact afternoon.",
    note: "A small, good day you'd forgotten.",
  },
  {
    tag: "what kept returning",
    tone: "sage",
    date: "2013 to 2023",
    quote: "Be patient with yourself. You're still learning.",
    note: "The same quiet way you've always talked yourself back onto your feet.",
  },
  {
    tag: "how far you've come",
    tone: "blush",
    date: "2017 to today",
    quote: "I cried in the office bathroom again and told no one.",
    note: "A season you moved all the way through.",
  },
  {
    tag: "something you knew",
    tone: "sepia",
    date: "October 2019",
    quote:
      "Maybe I don't have to fix this. Maybe I just have to feel it and let it pass.",
    note: "A truth that took years to trust.",
  },
];

const STEPS: { n: string; t: string; d: string }[] = [
  {
    n: "01",
    t: "Write",
    d: "Write today's page, or bring in years of old ones. It doesn't need to be wise, only honest.",
  },
  {
    n: "02",
    t: "Keep",
    d: "Your pages are kept private and encrypted, sorted by date and by year. Yours alone.",
  },
  {
    n: "03",
    t: "Return",
    d: "When you ask, Yadegar reads across your years and places one page back in front of you, or stays quiet when nothing honest surfaces.",
  },
  {
    n: "04",
    t: "Reflect",
    d: "Write back to the person who wrote it. Letters across time, kept side by side.",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-xs uppercase tracking-[0.22em] text-faint-ink text-center mb-6">
      {children}
    </p>
  );
}

function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// A page Yadegar might bring back, styled like the real product's memory card.
function DemoCard({ r }: { r: (typeof RETURNS)[number] }) {
  return (
    <motion.div
      key={r.tag + r.quote}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="border border-border rounded-2xl bg-surface/90 p-6 md:p-7 text-left shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="font-sans text-xs px-2.5 py-1 rounded-full"
          style={TONES[r.tone]}
        >
          {r.tag}
        </span>
        <span className="font-sans text-xs text-faint-ink">{r.date}</span>
      </div>
      <p className="font-display italic text-xl md:text-2xl text-deep-brown leading-snug mb-3">
        “{r.quote}”
      </p>
      <p className="font-body text-soft-ink">{r.note}</p>
    </motion.div>
  );
}

// Interactive taste of the engine, click to surface one return, cycle through
// more. Curated examples (no live model call); same voice as the real product.
function ReturnDemo({ onCreate }: { onCreate: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [i, setI] = useState(0);
  const r = RETURNS[i % RETURNS.length];

  if (!revealed) {
    return (
      <div className="text-center">
        <button
          onClick={() => setRevealed(true)}
          className="rounded-full border border-accent-sepia/40 bg-surface px-6 py-3 font-sans text-sm text-ink hover:border-accent-sepia transition-colors"
          data-testid="button-demo-return"
        >
          ✦ Bring a page back
        </button>
        <p className="font-sans text-xs text-faint-ink mt-3">
          a glimpse of what Yadegar returns
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[560px] mx-auto">
      <DemoCard r={r} />
      <div className="flex items-center justify-center gap-6 mt-5">
        <button
          onClick={() => setI((n) => n + 1)}
          className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
          data-testid="button-demo-another"
        >
          Show me another →
        </button>
        <button
          onClick={onCreate}
          className="font-sans text-sm text-accent-sepia hover:text-deep-brown border-b border-accent-sepia/40 pb-0.5 transition-colors"
        >
          Read across your own years
        </button>
      </div>
      <p className="font-sans text-xs text-faint-ink text-center mt-4">
        These are examples. With your own journals, every page is yours.
      </p>
    </div>
  );
}

export function Landing({
  onCreate,
  onSignIn,
}: {
  onCreate: () => void;
  onSignIn: () => void;
}) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background overflow-x-hidden">
      <AmbientField />

      {/* Nav */}
      <nav className="w-full flex items-center justify-between px-6 md:px-10 py-5">
        <span className="font-display text-xl text-deep-brown tracking-tight">
          Yadegar
        </span>
        <div className="flex items-center gap-5">
          <Link
            href="/shop"
            className="hidden sm:inline font-sans text-xs uppercase tracking-[0.18em] text-soft-ink hover:text-ink transition-colors"
          >
            Shop
          </Link>
          <Link
            href="/pricing"
            className="hidden sm:inline font-sans text-xs uppercase tracking-[0.18em] text-soft-ink hover:text-ink transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/why"
            className="hidden sm:inline font-sans text-xs uppercase tracking-[0.18em] text-soft-ink hover:text-ink transition-colors"
          >
            Why Yadegar
          </Link>
          <button
            onClick={onSignIn}
            className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
            data-testid="button-hero-signin"
          >
            Sign in
          </button>
          <button
            onClick={onCreate}
            className="rounded-full bg-deep-brown text-background px-4 py-1.5 font-sans text-sm hover:bg-ink transition-colors"
          >
            Create account
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header className="px-6 pt-16 pb-24 md:pt-24 md:pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="max-w-[640px] mx-auto"
        >
          <p
            className="font-display text-3xl text-accent-sepia/70 mb-2"
            dir="rtl"
            lang="fa"
          >
            یادگار
          </p>
          <h1 className="font-display text-7xl md:text-8xl text-deep-brown leading-none mb-6">
            Yadegar
          </h1>
          <p className="font-body italic text-lg md:text-xl text-accent-sepia mb-7">
            Persian: a keepsake, the thing that remains
          </p>
          <p className="font-body text-lg md:text-xl text-soft-ink leading-relaxed mb-10 max-w-[34rem] mx-auto">
            A companion to a lifelong journaling practice. It reads across your
            years and brings back one page worth returning to, gently, and
            always in your own words.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onCreate}
              className="rounded-full bg-deep-brown text-background px-8 py-3 font-sans text-sm hover:bg-ink transition-colors"
              data-testid="button-hero-register"
            >
              Create account
            </button>
            <Link
              href="/why"
              className="rounded-full border border-border bg-surface/70 text-ink px-8 py-3 font-sans text-sm hover:border-accent-sepia transition-colors"
            >
              Why I built this
            </Link>
          </div>
          {/* App Store download CTA (live; kill switch VITE_APP_STORE_LIVE=0). */}
          <AppDownloadCTA className="mt-8" />
        </motion.div>
      </header>

      {/* What comes back, example returns */}
      <section className="px-6 py-20 md:py-24 bg-[#F1EADD]">
        <div className="max-w-[720px] mx-auto">
          <Reveal>
            <Eyebrow>What comes back</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl text-deep-brown text-center leading-tight mb-10 max-w-[34rem] mx-auto">
              Not a summary of your life. One page, returned at the moment it's
              true again.
            </h2>
          </Reveal>
          <Reveal>
            <ReturnDemo onCreate={onCreate} />
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 md:py-24">
        <div className="max-w-[640px] mx-auto">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
          </Reveal>
          <div className="flex flex-col">
            {STEPS.map((s) => (
              <Reveal key={s.n}>
                <div className="flex gap-6 py-6 border-t border-border/70 first:border-0">
                  <span className="font-display text-2xl text-faint-ink shrink-0 w-10">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl text-deep-brown mb-1.5">
                      {s.t}
                    </h3>
                    <p className="font-body text-soft-ink leading-relaxed">
                      {s.d}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* The word */}
      <section className="px-6 py-20 md:py-28 bg-[#F1EADD] text-center">
        <div className="max-w-[600px] mx-auto">
          <Reveal>
            <Eyebrow>The word</Eyebrow>
            <p
              className="font-display text-6xl md:text-7xl text-deep-brown mb-4"
              dir="rtl"
              lang="fa"
            >
              یادگار
            </p>
            <p className="font-body italic text-soft-ink mb-1">
              yadegar · Persian, noun
            </p>
            <p className="font-sans text-sm text-faint-ink mb-6">
              said <span className="text-soft-ink">yaa-deh-gar</span>
            </p>
            <p className="font-body text-lg md:text-xl text-soft-ink leading-relaxed mb-5">
              A keepsake. A memento. The trace a person, or a time, leaves
              behind. The thing that remains.
            </p>
            <p className="font-body text-soft-ink leading-relaxed">
              Some journals are lost in moves. Some are thrown away by mistake.
              But the pages that remain can still speak.
            </p>
          </Reveal>
        </div>
      </section>

      {/* A note from the maker */}
      <section className="px-6 py-20 md:py-24">
        <div className="max-w-[600px] mx-auto">
          <Reveal>
            <Eyebrow>A note from the maker</Eyebrow>
            <p className="font-display italic text-2xl md:text-3xl text-deep-brown leading-snug text-center mb-6">
              “I didn't know it then, but I was building a conversation with
              myself. One that would last decades.”
            </p>
            <p className="font-body text-soft-ink leading-relaxed text-center mb-7">
              I've kept a journal through every version of myself, and lost some
              of them along the way. Yadegar is for the pages that remain.
            </p>
            <p className="text-center">
              <Link
                href="/why"
                className="font-sans text-sm text-accent-sepia hover:text-deep-brown border-b border-accent-sepia/40 pb-0.5 transition-colors"
              >
                Read the full story →
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20 md:py-24">
        <div className="max-w-[720px] mx-auto">
          <Reveal>
            <Eyebrow>What it costs</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl text-deep-brown text-center leading-tight mb-3 max-w-[34rem] mx-auto">
              Free to keep. Yours to deepen.
            </h2>
            <p className="font-body text-soft-ink text-center leading-relaxed mb-10 max-w-[34rem] mx-auto">
              Your journal is always free: write, keep, import, export, and
              revisit the pages that return to you, without limit. Membership
              lifts the cap on new returns: Yadegar reading across your years,
              whenever you like.
            </p>
          </Reveal>
          <Reveal>
            <PricingCards />
          </Reveal>
          <Reveal>
            <p className="font-body text-faint-ink text-sm text-center mt-7 max-w-[34rem] mx-auto">
              We gate the AI, never your journal. Your words are always yours to
              write, keep, and take with you.
            </p>
            <p className="text-center mt-4">
              <Link
                href="/pricing"
                className="font-sans text-sm text-accent-sepia hover:text-deep-brown border-b border-accent-sepia/40 pb-0.5 transition-colors"
              >
                See plans &amp; pricing questions →
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 pt-20 pb-24 md:pt-24 md:pb-28 bg-[#F1EADD] text-center">
        <Reveal>
          <h2 className="font-display text-4xl md:text-5xl text-deep-brown mb-4">
            Meet the person you used to be.
          </h2>
          <p className="font-body text-soft-ink mb-9 max-w-[30rem] mx-auto">
            Free to start, membership when you're ready. Private by default,
            encrypted, and always in your own words.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onCreate}
              className="rounded-full bg-deep-brown text-background px-8 py-3 font-sans text-sm hover:bg-ink transition-colors"
            >
              Create account
            </button>
            <button
              onClick={onSignIn}
              className="rounded-full border border-border bg-surface/70 text-ink px-8 py-3 font-sans text-sm hover:border-accent-sepia transition-colors"
            >
              Sign in
            </button>
          </div>
          {/* App Store download CTA (live; kill switch VITE_APP_STORE_LIVE=0). */}
          <AppDownloadCTA className="mt-8" />
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 text-center font-sans text-xs text-faint-ink space-y-2">
        <p className="italic font-body text-sm">
          Offer the meaning, never push the moment.
        </p>
        <p className="space-x-3">
          <Link
            href="/why"
            className="hover:text-soft-ink transition-colors"
          >
            Why Yadegar
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/privacy-policy"
            className="hover:text-soft-ink transition-colors"
          >
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-soft-ink transition-colors">
            Terms
          </Link>
        </p>
      </footer>
    </div>
  );
}
