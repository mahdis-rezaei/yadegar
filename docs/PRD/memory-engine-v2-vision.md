# Memory Engine PRD V2 — vision (NOT yet built)

_Status: **future / not implemented.** The live engine is V1 (PROMPT_VERSION
2026-06-02.9), unchanged. This document captures Mahdis's V2 thinking so we can
evaluate together — once the full product is built — whether and how to evolve
the engine. Do not implement without an explicit decision._

## The shift
- **V1 thesis:** *Remember what endured.* ("Is this meaningful?")
- **V2 thesis:** *Bring back what belongs today.* ("Is this meaningful enough to
  return **today**?")

V1 finds significance. V2 finds **relevance**. A page can be meaningful, true,
beautiful, and still not be the right thing to surface today. The engine's job is
not to retrieve — it is to **recognize**. A journal preserves moments; a memory
engine preserves the **relationship** between who you were, who you are, and who
you are becoming.

## The Four Questions (every candidate answers all four, independently)

**1. Is it worth returning to?** — the V1 foundation, kept as-is: emotional
center, specificity, discovery, contradiction, worth_returning_to.

**2. Why today?** — new axis. A memory shouldn't appear just because it's good,
but because there's a reason to meet it now:
- **Temporal resonance** — same month/week/season, anniversary.
- **Thematic resonance** — recent entries touch belonging/family/home; a 2015
  page on the same thread becomes relevant by *participating in an active
  conversation*, not by repeating.
- **Life-stage resonance** — the writer stands near a similar threshold (career/
  relationship transition, moving, grief, becoming a parent). Goal is
  recognition, not prediction.

**3. Have we shown too much of this already?** — the **Diversity Layer**. A
journal is not a balanced dataset; people write far more when scared/lonely/lost
than when content. Without intervention the engine becomes *the Grief Retrieval
Machine*. Track recently-surfaced themes (loneliness, belonging, family,
ambition, love, identity, courage, creativity, curiosity, friendship, wonder) —
not to avoid them, but to prevent monopolies. Ask: *what parts of this person's
life have not been seen recently?* (not more important — just easier to forget).

**4. Is this still alive?** — distinguish **active** vs **enduring** vs
**completed** threads. "I wish I knew where home was" (2015) → "What does home
mean?" (2025) is *alive*. "I worry dad will support me forever" (2015), never
mentioned again → *resolved* = distance/perspective/closure, a different
experience. These produce different surfacings.

## Candidate types (classify, don't flatten)
1. **Forgotten Page** — a single vivid/surprising/specific page (monastery, brain-and-heart, six-bodies). Not a thread; just unforgettable.
2. **Enduring Thread** — recurs across years (home, belonging, courage, fear). The foundation of Still.
3. **Distance** — the most powerful: not what repeated, but what *changed*. Often invisible to the writer.
4. **Forgotten Wisdom** — a line written long ago that still feels true. Recognition, not advice.
5. **The Words You Saved** — current `value_signal`. Stays separate forever; saved words are not the writer's words.

## User Memory Model (new — learn softly, never like social media)
Signals: **favorites** (strong +), **full-entry opens** (medium +), **repeated
revisits** (medium +), **shares/exports** (strong +), **dismissal** (weak −).
Never punish; only gently reduce frequency. _(Note: the V1 schema already records
favorite, opened_at, dismissed on `returned_memories` — the raw signal is being
captured now.)_

## The Anti-Horoscope Rule
Never optimize for engagement, emotional intensity, sadness, or profundity. A
memory succeeds when the user says **"I forgot I wrote that"** or **"that's
true"** — not "wow." The goal is recognition, not amazement.

## Memory Rotation
Avoid repeating the same theme / period / emotional register too often. A life is
larger than its hardest chapter (belonging → friendship → wonder → courage →
family → creativity, not loneliness ×4).

## Success metrics
Not DAU/sessions/streaks, not even click-through. Instead:
- **Recognition Rate** — favorites, full opens, revisits.
- **Surprise Rate** — "I forgot this."
- **Reflection Rate** — the user writes after reading, unprompted, because the memory invited conversation.
- **Trust Rate** (most important) — never ambushed, manipulated, or analyzed; the user feels **accompanied**.

## The final test
A future Still should be able to answer: *of everything this person wrote over
ten years, why this page, on this day?* — and the answer should feel **inevitable
once seen**. Not the most emotional, most repeated, or saddest thing — the thing
that quietly belonged in today's conversation.

---

### How this maps to what's already built (for the eventual eval)
- The **nudge / "why today?"** feature (PRD nudges) is where V2's Question 2 first
  becomes load-bearing — when we build nudges we'll keep the seam simple but
  V2-shaped.
- `returned_memories` already stores favorite / opened_at / dismissed → the
  **User Memory Model** signals are being collected before the engine uses them.
- V2 is an **engine (Replit) change**; per our workflow it would be developed and
  guarded by the eval harness (`scripts/src/eval/`) before shipping, with a new
  PROMPT_VERSION. The harness would need new fixtures for relevance / diversity /
  aliveness, since those are cross-run properties V1's per-run fixtures don't test.
