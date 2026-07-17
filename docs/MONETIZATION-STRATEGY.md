# Yadegar — Monetization & Token Strategy

*Status: reviewed proposal. Grounded in a full read of the engine cost surface
(`artifacts/api-server/src/routes/still.ts`, `lib/memory-engine.ts`) and the
account/data model. Companion docs: `docs/MONETIZATION-BUILD-PLAN.md` (how) and
`docs/MONETIZATION-HANDOFF.md` (briefing). Corrections from the engine review are
folded in and marked **[review]**.*

> User-facing brand is **Yadegar**; internal code is **still**. This doc uses
> Yadegar for product/pricing language and `still`/code paths for engineering.

---

## 1. The cost reality

The product has **one expensive operation and almost nothing else.** Writing,
keeping, importing, browsing, organizing, exporting, and *date-based* return
("On This Day," Look Back browse, Timeline, Calendar) are all **$0 in model
cost** — pure Postgres + SQL. The only things that burn tokens are:

1. The **AI "return"** pipeline — `/memories/run` → two-pass `extract` → `score`
   (the engine behind "Bring a page back," "What keeps returning," voiced
   look-backs, and the engine-fallback nudge email).
2. Per-entry **safety/theme classification**, mostly incurred **on import**.

| Action | Model cost | Why |
|---|---|---|
| Write / keep / edit a page | **$0** | No LLM, ever |
| Browse Library, Collections, Shelf, Capsules, Timeline, Calendar | **$0** | Pure SQL |
| "On This Day" / date-based Look Back | **$0** | SQL, pre-filtered by a stored safety flag |
| **A fresh AI return** | **~$0.08–0.15** | Two-pass; PASS-2's ~8.3K-token system prompt dominates |
| **Re-opening a past return** (Returns shelf) | **~$0.002** | Served from the result cache |
| Importing old journals | **~$0.004–0.007 / entry** (one-time) | Per-entry classify; a 1,000-entry archive ≈ **$4–7 once** |

### Worked economics (per fresh return, Sonnet 4.6 @ $3/M in, $15/M out)

| | Input tok | Output tok |
|---|---|---|
| Crisis check (system + most-recent entry) | ~900 | ~50 |
| PASS 1 extract (1.7K system + ~3.5K data) | ~5,200 | ~1,500 |
| PASS 2 score (8.3K system + ~3K candidates) | ~11,300 | ~2,500 |
| **Total** | **~17,400** | **~4,050** |

- **Cold return (no prompt caching):** 17.4K×$3/M + 4.05K×$15/M ≈ **$0.11**
- **With Anthropic prompt caching** on the ~10.3K static system tokens: ≈
  **$0.085 steady-state.** **[review]** This is a *steady-state-at-volume*
  number. Anthropic's prompt cache is ephemeral (~5-min TTL); cache *writes*
  cost ~1.25× and *reads* ~0.1×. The system prompt is identical across all
  users, so at real traffic (>1 run / 5 min globally) almost every call is a
  cheap read and ~$0.085 holds — but **at launch / low volume, calls are often
  cold**, paying the 1.25× write with no read benefit, so early cost stays ~$0.11
  (or marginally above). Still worth doing — it's free to add and scales with you
  — just don't bank the savings on day one.
- **Cached re-open (DB result cache hit):** ≈ **$0.002** (crisis check only).

### Three facts that drive everything

1. **Cost ≈ value ≈ "fresh AI returns."** The thing that costs money is exactly
   the thing users find magical. The natural paywall line is obvious *and fair*.
2. **The journal is nearly free to host and is the entire moat.** Years of an
   encrypted diary is the highest-switching-cost asset a consumer app can hold.
3. **There is no metering today** — only a crude in-memory 30/hour cap on
   `/memories/run` (verified). A determined free user could trigger ~700 fresh
   returns/day ≈ **~$70/day of our money.** Closing this leak is priority #1,
   independent of pricing.

---

## 2. Governing principle: **gate the AI, never the journal**

> **Never paywall a person's ability to write, keep, import, browse, or export
> their own pages. Charge for the AI that reads across them.**

- **Economics:** writing/keeping/browsing cost ~$0, so capping them earns nothing
  and only adds friction.
- **Brand:** Yadegar is a calm, anti-engagement keepsake ("the thing that
  remains"). *"You've used 2 of 3 entries this month"* betrays that promise and
  torches the retention/lock-in that makes the paid AI valuable.
- **Strategy:** the free journal is the acquisition engine and the moat.
  **Subsidize the writing; monetize the meaning.**

This settles the "limit number of entries?" question: **no.** Entry caps are the
one model to rule out.

---

## 3. Recommended model: Freemium subscription, metered on *fresh* returns

| | **Free — "Your journal"** | **Member — "Yadegar"** |
|---|---|---|
| Write / keep / edit / import / export | ✅ Unlimited | ✅ Unlimited |
| Organize: Collections, Shelf, Capsules, favorites | ✅ | ✅ |
| Date-based return: On This Day, Look Back browse | ✅ | ✅ |
| **Fresh AI returns** (Bring a page back, What Keeps Returning, voiced Revisit, Then & Now) | **4 / month** ("about one a week") + small onboarding bonus (~first 3) | ✅ Unlimited (fair use) |
| **Revisiting past returns** (Returns shelf) | ✅ Always free | ✅ Always free |
| Memory **nudge emails** | — | ✅ |
| Year keepsake: basic print/PDF of your own year **[review]** | ✅ (your data) | ✅ |
| A *designed* multi-year / physical Book **[review]** | — | ✅ |
| **Price** | $0 | **$8/mo, or $59/yr (annual-first ≈ $4.92/mo)** |

> **Pricing.** $8/mo sits below AI-journaling peers (Rosebud/Mindsera $9–13); the
> annual $59 (~$4.92/mo) is competitive with plain journaling apps (Day One ~$35,
> Stoic ~$40) while offering far more. Fair on *both* sides only because per-return
> cost is bounded (§5.1).

> **[review] Book-as-perk tension.** §2 says never paywall export, yet "printable
> Year-in-Pages" was listed as member-only. Yadegar *means* keepsake — gating the
> keepsake-print is the most brand-dangerous line in the plan. **Thread the
> needle:** a basic print/PDF of your own year stays **free** (it's your data); the
> member perk is a *designed* artifact (multi-year Book, nicer layout, optional
> physical). Raw privacy export is always free regardless.

### The mechanic that makes this elegant

**Count a return against quota only when it causes a real model call (a cache
miss).** Re-opening anything in the Returns shelf is always free, for everyone.

- Quota maps 1:1 to actual COGS — we charge for spend, not for nothing.
- On-brand framing: *"Revisiting what's returned to you is always free. Bringing
  back something new is part of Yadegar."* No token counter.

> **[review] Re-rolls burn quota — this is the sharpest practical gap.** The
> "What keeps returning" surface and its "look again" / "show another" controls
> send **`fresh: true`**, which *bypasses the cache and forces a fresh model call
> on every click* (verified in `what-keeps-returning.tsx`). Under cache-miss
> metering, **each re-roll is a separate fresh return** — so a free user can
> vaporize the month's 4 in a single sitting hitting "show another," and "4/mo"
> secretly means "4 clicks/mo." **Decision required before launch:** either
> exempt re-rolls *of the same surfacing within a short window* from the counter
> (recommended — it's the same DB run, just re-rolled), or size/communicate the
> free allowance to include re-rolls. Don't ship the quota without resolving this.

### Why these numbers work

| Cohort | Fresh returns / mo | COGS / mo @ $0.085 | Notes |
|---|---|---|---|
| Free user | ~4 | **~$0.34** | Sustainable acquisition cost |
| Typical paid | ~12 | **~$1.02** | vs ~$8 price → **~85% gross margin** |
| Heavy paid | ~60 | **~$5.10** | Fair-use keeps this rare; still ≥ $0 |

Lead with **annual** (where journaling revenue lives).

---

## 4. Why not the alternatives

- **Limit number of entries → No.** Brand-hostile, kills the moat, saves ~$0.
- **Visible token/credit meter → No (user-facing).** Track tokens internally;
  express cost to users as **"fresh returns."**
- **Pure pay-as-you-go credits → No as primary.** Fine only as a **secondary
  top-up** for the rare user past fair use.
- **"Limit tokens then upsell" → Yes, but disguised** as a *return count*.

---

## 5. Fair use, abuse, and the import cost bomb

### 5.1 The long-entry exposure (and why flat pricing is still safe)

The engine caps the *number* of entries per return (25, time-spread) but **not the
size of each entry**. Today a 30K-word entry is read in full by the crisis check
and extract. **This is the real abuse vector**, and it's also a **correctness**
problem: extract and score already hit `stop_reason === "max_tokens"` on large
pools today (verified) → truncated JSON → 500s. The fix:

> **Cap what the model READS per entry, never what the user WRITES.** Users keep
> writing any length, for free. The engine reads a bounded, representative window
> per entry, plus a total per-call input budget (~30K tokens) that trims the pool
> if needed.

**[review] How to window matters — don't naively truncate.** The engine's whole
value is finding "the one line where the truth slipped out," which in a long entry
can be *anywhere*. A "first ~800 tokens" cut risks dropping exactly the resonant
line for introspective long-form writers (the best users). Use **sentence
sampling** (head + sampled middle + tail), and **validate with the eval harness
plus a new long-entry fixture** to prove the cap engages without degrading
selection. (The v2 embeddings lever in §6a does this *properly*.)

**[review] Crisis is a safety exception — do NOT aggressively truncate it.** The
crisis check reads the most-recent entry and is told to weight it heaviest. If you
cap it to a small window, a crisis statement at the *end* of a long entry is
missed — a false negative, the worst possible outcome. Give the crisis check a
**much larger read budget** (read the recent entry nearly in full); the cost cap
must not touch safety. (Crisis input is small anyway.)

Net: with sentence-sampled windowing on extract/score and a generous budget for
crisis, worst-case is a **fixed ~$0.15 per fresh return** — the precondition for
fair flat pricing.

### 5.2 Member fair-use & import

- **Fair-use ceiling on "unlimited":** the per-return bound (§5.1) applies to
  everyone, plus a gentle soft slow-down past a generous daily count (~6–8 fresh
  returns/day), reusing existing copy. Optional top-up credits later.
- **Import is the biggest one-time spend** (~$4–7 / 1,000 entries; less with the
  window). **Do not gate import** — it's the wow moment. Fix it in engineering
  (§6): Haiku + lazy classification + the per-entry window.

---

## 6. Token / COGS optimization (do these regardless of pricing)

1. **Anthropic prompt caching on the static system prompts** — the single biggest
   lever **at scale** (see the §1 TTL/volume caveat: marginal at launch).
2. **Tier the model (within Anthropic) — see §6a.** Haiku for hard-floor + theme
   (~⅓ cost; import ~$5 → ~$1.7 / 1,000). Keep **Sonnet for extract→score and the
   crisis check.**
3. **Lazy-classify on import.** Defer per-entry tagging until an entry is an
   actual resurfacing candidate.
4. **Build per-user usage metering** — prerequisite for quota + COGS visibility.
5. **Later (careful):** trim PASS-2 output/system size, guarded by the eval
   harness. Treat as v2.

---

## 6a. Model & provider strategy

**Today:** every call (extract, score, crisis, hard-floor, theme) runs on a single
pinned `claude-sonnet-4-6`, all Anthropic.

**Recommendation: keep all journal-content calls inside Anthropic, but tier:**

| Call | Model | Why |
|---|---|---|
| Extract → Score (the prose) | **Sonnet** | Quality is the product |
| Crisis check | **Sonnet** (keep) | Safety-critical; a false negative is the worst outcome |
| Hard-floor + Theme tagging | **Haiku** (`claude-haiku-4-5-20251001`) | Trivial JSON; ~⅓ cost; hard-floor fails-closed |

**Why single-vendor (don't route content to OpenAI/Gemini/Groq):** privacy is a
brand pillar ("never shared with third parties") — every extra LLM vendor is a
data processor to disclose and trust. And the ~8.3K PASS-2 prompt is tuned to this
model; the **eval harness is the seam** for any in-Anthropic swap.

**Later lever (v2): embeddings-based pre-selection** — cheaply embed entries (and
*segments* of long entries) to pick the most resonant/diverse candidates instead
of dumping 25 full bodies. Cuts tokens, bounds huge archives, *and* solves the
long-entry quality risk in §5.1. Anthropic has no embeddings API, so use a
**self-hosted/local embedding model** to avoid adding a vendor.

## 7. Bottom line

**Freemium at $8/mo or $59/yr, journal unconditionally free, the *fresh AI return*
the paid unit — metered by count, never visible tokens, free to revisit forever.**
Fair on both sides because per-return cost is bounded (window what the model reads,
not what users write — with crisis exempted for safety). Pair with prompt caching
(scales with volume) + Haiku-for-classification to roughly halve per-return COGS.
Keep all content on Anthropic for privacy. **Resolve the re-roll-metering question
(§3) before shipping the quota.**

See `docs/MONETIZATION-BUILD-PLAN.md` for the phased implementation.
