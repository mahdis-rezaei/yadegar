import { useLocation } from "wouter";
import { motion, useScroll, useReducedMotion } from "framer-motion";
import { AmbientField, SiteNav } from "@/components/site-chrome";

// The maker's note, Mahdis's words, unchanged. Set as a short film in
// movements: stanzas (tight within, generous between), divider rules between
// acts, the Sohrab Sepehri line as a pull-quote, and the two whispered inner
// voices set apart. Calm per-stanza reveal (not per line), static under
// reduced-motion.

type Block =
  | { kind: "stanza"; lines: string[]; lead?: boolean }
  | { kind: "quote"; text: string }
  | { kind: "whisper"; lines: string[] }
  | { kind: "reveal" } // the name reveal, "...I called this Yadegar."
  | { kind: "rule" };

const NOTE: Block[] = [
  {
    kind: "stanza",
    lead: true,
    lines: [
      "When I was a child, every year I got a new journal.",
      "Some were simple notebooks.",
      "Some had little locks on them.",
      "I loved those ones.",
      "I remember holding the tiny key in my hand and feeling like I had a secret world that belonged only to me.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Inside those pages lived everything.",
      "School.",
      "Friends.",
      "Crushes.",
      "Big dreams.",
      "Very dramatic heartbreaks.",
      "Questions about life that I was certain nobody else had ever asked before.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "I wrote when I was excited.",
      "I wrote when I was confused.",
      "I wrote when I was lonely.",
      "I wrote when I had nowhere else to put what I was feeling.",
      "I didn't know it then, but I was building a conversation with myself.",
      "One that would last decades.",
    ],
  },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "Over the years, the journals followed me everywhere.",
      "Across countries.",
      "Across languages.",
      "Across versions of myself.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "A little girl in Iran.",
      "A teenager trying to understand the world.",
      "A young woman leaving home.",
      "An immigrant trying to build a life.",
      "Someone falling in love.",
      "Someone getting her heart broken.",
      "Someone sitting on a train, writing because there was too much happening inside her chest.",
      "Someone awake at three in the morning asking questions she couldn't answer.",
    ],
  },
  { kind: "stanza", lines: ["And through all of it, I kept writing."] },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "Some of those journals are gone now.",
      "Lost during moves.",
      "Thrown away by mistake.",
      "Left behind somewhere between one version of my life and the next.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Nobody meant harm.",
      "Life was happening.",
      "Boxes were being packed.",
      "There was never enough room for everything.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "But sometimes I think about those notebooks and feel a quiet ache.",
      "Not because I think they were brilliant.",
      "Most of them were probably messy and dramatic and full of terrible handwriting.",
      "But they held people I can no longer fully reach.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "A twelve-year-old me.",
      "A seventeen-year-old me.",
      "A twenty-one-year-old me.",
      "Entire worlds that existed for a little while and then disappeared into time.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "I wish I could sit beside them sometimes.",
      "Just for an afternoon.",
      "Not to change anything.",
      "Just to listen.",
    ],
  },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "I have lived in many places since then.",
      "Iran.",
      "New Delhi.",
      "Malaysia.",
      "Rome.",
      "London.",
      "New York.",
      "Los Angeles.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Each place changed me.",
      "Each place left something behind.",
      "And after enough years, enough moves, enough becoming, I started noticing something.",
      "It is surprisingly easy to lose touch with your own story.",
    ],
  },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "So I kept writing.",
      "In journals.",
      "In notebooks.",
      "In iPhone Notes.",
      "In Google Docs.",
      "In emails to myself.",
      "In the margins of books.",
      "Sometimes at a desk.",
      "Sometimes on a plane.",
      "Sometimes in a bathtub before sunrise, holding a cup of coffee and trying to understand why my heart felt heavy.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Every Christmas, I still buy myself a new journal.",
      "Over the years I started buying them for my siblings and close friends too.",
      "A journal has always felt like one of the most loving gifts you can give someone.",
      "Not because it gives answers.",
      "Because it says:",
    ],
  },
  { kind: "whisper", lines: ["Here.", "This is a place where all of you gets to exist."] },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "Years ago, I kept returning to a poem by Sohrab Sepehri.",
      "I copied parts of it into my journals again and again.",
      "One line stayed with me:",
    ],
  },
  { kind: "quote", text: "We must wash our eyes and see differently." },
  {
    kind: "stanza",
    lines: [
      "At the time, I thought it was a poem about the world.",
      "Now I wonder if it is also a poem about memory.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Because something strange happens when you return to an old journal.",
      "The page has not changed.",
      "The words have not changed.",
      "But you have.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "You find a sentence you forgot you wrote.",
      "You meet a younger version of yourself.",
      "You notice a fear that no longer owns you.",
      "A dream that somehow survived.",
      "A question that followed you across years.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Sometimes your heart breaks a little.",
      "Sometimes you laugh.",
      "Sometimes you want to reach through time and hug the person who wrote those words.",
      "And sometimes you realize she was doing much better than she thought.",
    ],
  },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "I think that feeling is what led me to build Yadegar.",
      "Not a tool that tells you what your life means.",
      "Not a tool that turns your memories into lessons.",
      "Just a companion.",
      "Something that can sit beside years of journals and gently place a page back in front of you.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "A line.",
      "A memory.",
      "A question.",
      "A version of yourself.",
      "Something waiting quietly for years to be seen again.",
    ],
  },
  { kind: "reveal" },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "Because so much changes.",
      "Countries change.",
      "Jobs change.",
      "Relationships change.",
      "Dreams change.",
      "We change.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "And yet, when I return to my journals, I almost always find something that is still there.",
      "A hope.",
      "A fear.",
      "A question.",
      "A way of speaking to myself.",
      "A voice saying:",
    ],
  },
  { kind: "whisper", lines: ["Hi my dear one.", "Come sit next to me.", "I'm here."] },
  {
    kind: "stanza",
    lines: [
      "And sometimes all it takes is one old sentence to remember who you were, how you felt, and how far you have come.",
    ],
  },
];

export default function Why() {
  const [, setLocation] = useLocation();
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AmbientField />
      {!reduce && (
        <motion.div
          className="fixed top-0 left-0 right-0 h-0.5 bg-accent-sepia/60 origin-left z-50"
          style={{ scaleX: scrollYProgress }}
          aria-hidden="true"
        />
      )}
      <SiteNav showWhy={false} />

      <main className="flex-1 w-full max-w-[640px] mx-auto px-6 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="font-sans text-xs uppercase tracking-[0.22em] text-faint-ink mb-5">
            A note from the maker
          </p>
          <h1 className="font-display text-5xl md:text-6xl text-deep-brown leading-tight mb-16">
            why I built Yadegar
          </h1>
        </motion.div>

        <article className="space-y-9 md:space-y-11">
          {NOTE.map((block, i) => (
            <Block key={i} block={block} reduce={!!reduce} />
          ))}
        </article>

        <div className="h-px bg-border my-14" />

        <p className="font-body italic text-xl text-soft-ink mb-10">Mahdis</p>

        <button
          onClick={() => setLocation("/login")}
          className="rounded-full bg-deep-brown text-background px-8 py-3 font-sans text-sm hover:bg-ink transition-colors"
          data-testid="button-begin"
        >
          Begin →
        </button>
      </main>
    </div>
  );
}

function Reveal({
  reduce,
  children,
}: {
  reduce: boolean;
  children: React.ReactNode;
}) {
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function Block({ block, reduce }: { block: Block; reduce: boolean }) {
  if (block.kind === "rule") {
    return (
      <div className="flex justify-center py-1" aria-hidden="true">
        <span className="block w-10 h-px bg-border" />
      </div>
    );
  }

  if (block.kind === "quote") {
    return (
      <Reveal reduce={reduce}>
        <blockquote className="text-center py-2">
          <p className="font-display italic text-2xl md:text-3xl text-deep-brown leading-snug">
            “{block.text}”
          </p>
        </blockquote>
      </Reveal>
    );
  }

  if (block.kind === "whisper") {
    return (
      <Reveal reduce={reduce}>
        <div className="text-center space-y-1.5 py-2">
          {block.lines.map((line, i) => (
            <p
              key={i}
              className="font-body italic text-xl md:text-2xl text-deep-brown leading-snug"
            >
              {line}
            </p>
          ))}
        </div>
      </Reveal>
    );
  }

  if (block.kind === "reveal") {
    return (
      <Reveal reduce={reduce}>
        <div className="space-y-1.5">
          <p className="font-body text-lg md:text-xl text-soft-ink leading-relaxed">
            And perhaps that is why I called this{" "}
            <em className="italic text-deep-brown">Yadegar</em>.
          </p>
          <p className="font-body text-lg md:text-xl text-soft-ink leading-relaxed">
            In Persian, it means a keepsake, the thing that remains.
          </p>
        </div>
      </Reveal>
    );
  }

  // stanza, tight spacing within; the opening one sits a shade darker.
  return (
    <Reveal reduce={reduce}>
      <div className="space-y-1.5">
        {block.lines.map((line, i) => (
          <p
            key={i}
            className={
              "font-body text-lg md:text-xl leading-relaxed " +
              (block.lead ? "text-ink" : "text-soft-ink")
            }
          >
            {line}
          </p>
        ))}
      </div>
    </Reveal>
  );
}
