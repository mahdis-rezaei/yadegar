import { createHash } from "node:crypto";
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, stillResultsTable } from "@workspace/db";
import { chooseSeamOverride } from "../lib/why-today";

const router = Router();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Pinned to an exact version (never a floating alias) so a model auto-upgrade
// can't silently change results.
const MODEL = "claude-sonnet-4-6";
// A cheaper, faster model for LOW-STAKES classification only — currently just the
// library-shelf theme tag (neutral topical filing, never a safety or selection
// decision). Everything that affects what surfaces (extract, score, the override
// voice pass) AND every safety check (§3.1 crisis, the §3 whole-entry hard floor)
// stays on MODEL until a fixture proves the lighter model holds the same line.
// Pinned, not aliased, for the same no-silent-drift reason as MODEL.
const MODEL_LIGHT = "claude-haiku-4-5-20251001";
// PASS1 (extraction) output budget. A rich, time-spread pool produces a verbose
// candidate list; 4096 still truncated it on a multi-hundred-entry archive (→
// stop_reason "max_tokens" → invalid JSON → 500). 8192 gives ample headroom for
// the bounded pool (MAX_EXTRACTION_ENTRIES) without risking truncation.
const MAX_TOKENS_PASS1 = 8192;
// PASS2 (scoring) output budget. The scores array is verbose — one object per
// candidate, echoing displayable quote text + gates + axes + why — so a large
// candidate set overran 8000 and truncated the JSON (→ 500). 16000 gives ample
// headroom for the bounded candidate set; the model only emits what it needs, so
// raising the ceiling costs nothing when output is small. (A leaner output schema
// — indices instead of echoed quote text — is the durable efficiency fix later.)
const MAX_TOKENS_PASS2 = 16000;
// The crisis safety check only returns a tiny {crisis, reason} JSON.
const MAX_TOKENS_CRISIS = 600;
// Per-entry read window (Phase 0 COGS/latency bound). A single pathologically
// long entry inflates token cost and latency without improving the find — the
// engine reasons over sentences, and signal saturates well before tens of
// thousands of characters. Entries longer than this are sentence-sampled (head +
// tail kept verbatim, the middle thinned at an even stride). The cap is high
// enough that ordinary entries pass through byte-for-byte (so the calibrated eval
// board is unchanged); only oversized entries are reshaped. The §3.1 CRISIS check
// is deliberately NOT windowed — it reads the writer's present state in full so a
// crisis line can never be sampled away (safety is never truncated).
const READ_WINDOW_ENTRY_CHARS = 12000;
// The whole-entry hard-floor check returns a tiny {hard_floor, reason} JSON.
const MAX_TOKENS_HARD_FLOOR = 200;

// Server-authored so the care message is consistent and safe — the model only
// classifies whether crisis is present; it never writes the support copy. Warm,
// brief, non-clinical, and pointing at real, reachable support.
const CRISIS_SUPPORT_MESSAGE =
  "Right now, the thing that matters most isn't anything in these pages — it's you. " +
  "If you're thinking about harming yourself, or you're not sure you can keep going, " +
  "please reach out to someone who can be with you through this. In the US you can call " +
  "or text 988, any time, to reach the Suicide & Crisis Lifeline. Outside the US, " +
  "findahelpline.com lists free, confidential lines near you. You don't have to hold this alone.";

// Part of every cache key. BUMP this whenever any prompt, axis, gate, the
// resolution penalty, the voice block, or the why field changes — bumping it
// automatically invalidates the result cache so you never serve stale results
// while tuning.
const PROMPT_VERSION = "2026-06-05.4";

// A focused, sensitivity-biased safety classifier run BEFORE extraction. It only
// answers "is the writer in active, present-tense crisis right now?" — distinct
// from survived past difficulty, which is the normal raw material this tool
// reflects on. Per §3.1 this is a prototype safeguard: err toward crisis=true
// when genuinely uncertain. It never analyzes, diagnoses, or pathologizes.
const PASS_CRISIS_SYSTEM = `You are a safety check for a private journaling reflection tool. Your ONLY job is to decide whether the writing shows the person is in ACTIVE, PRESENT crisis right now — so the tool can offer support instead of a reflection. You are NOT a clinician. Do NOT diagnose, analyze, interpret, label, or explain. You output a single yes/no.

ACTIVE PRESENT CRISIS — answer crisis=true if the writer, in their CURRENT state, expresses any of:
- thoughts of suicide, ending their life, not wanting to be alive, or being better off dead;
- a wish, plan, urge, or intent to harm themselves now;
- acute, present-tense despair or hopelessness that reads as happening NOW ("I can't do this anymore", "I don't want to be here", "there's no point in going on", "I want it to stop").

PAY SPECIAL ATTENTION TO THE MOST RECENT ENTRY — the one with the latest date, or the last one in the input if dates are absent. Active crisis in the most recent entry matters most, because it reflects where the writer is now.

NOT a crisis — answer crisis=false for:
- SURVIVED past difficulty described from a place of having come through it ("that was the hardest year of my life, but I made it", "back then I wanted to disappear, and I'm still here");
- ordinary sadness, stress, grief, exhaustion, frustration, loneliness, or venting that is not about ending one's life or harming oneself;
- reflection, growth, or meaning-making about a hard season.

CRITICAL DISTINCTION: separate ACTIVE PRESENT crisis from SURVIVED PAST difficulty. Past pain the writer has moved through is NOT a crisis — it is the normal material this tool reflects on. The signal is present-tense, current self-harm or despair, especially in the most recent entry.

PROTOTYPE SAFEGUARD: when you are genuinely UNCERTAIN whether something is active present crisis versus survived past difficulty, choose crisis=true — it is better to offer support unnecessarily than to miss someone in crisis. But do NOT flag ordinary sadness or clearly-survived past pain.

Output ONLY valid JSON, no preamble, no markdown fences, no reasoning. The first character must be "{":
{"crisis": true, "reason": "one short phrase"}`;

// A focused whole-entry hard-floor classifier for DATE-BASED resurfacing. The §3
// hard floor is absolute: body weight, eating, dieting, physical appearance, or
// self-image content is never surfaced. The engine's line-level gate handles this
// for engine-selected lines; this answers the whole-entry question the date-based
// surfacer needs: "would resurfacing THIS entire page put body/appearance/eating
// material in front of the writer?" If yes, the page is never resurfaced by date.
const PASS_HARD_FLOOR_SYSTEM = `You are a safety check for a private journaling tool that sometimes resurfaces a whole past entry ("on this day a few years ago"). Your ONLY job is to decide whether resurfacing this entire entry would put BODY/APPEARANCE/EATING material in front of the writer. You are NOT a clinician. Do NOT diagnose, analyze, interpret, or explain. You output a single yes/no.

Answer hard_floor=true if the entry is CENTRALLY or SUBSTANTIALLY about any of:
- body weight, the number on a scale, gaining or losing weight;
- eating, dieting, restricting, bingeing, purging, calories, or food guilt;
- physical appearance, body size/shape, or how the writer's body looks;
- self-image tied to the body ("I hate how I look", "I feel disgusting in my body").

Answer hard_floor=false when:
- the body is mentioned only in passing and is not what the entry is about;
- the entry is about ordinary life, feelings, events, relationships, work, meaning — even if it is sad or hard;
- a meal or the body appears incidentally (e.g. "we cooked dinner together", "I went for a run and felt alive") without focus on weight/appearance/eating control.

JUDGE THE FOCUS, NOT A SINGLE WORD. A lone passing remark about the body or weight — one line in an entry that is otherwise about mood, the day, work, family, or just getting through a hard night — does NOT meet the "centrally or substantially" bar. For example, an entry venting a messy low mood that includes "I feel annoyingly fat" among a list of mixed feelings, then moves on to job worries and steadying itself, is NOT a body/appearance entry → hard_floor=false. The floor fires only when the entry RETURNS to and DWELLS on weight/eating/appearance as its real subject (several lines, not one).

When genuinely UNCERTAIN whether the entry is SUBSTANTIALLY about these (it keeps coming back to the body/eating/appearance, not just names it once), choose hard_floor=true — it is better to withhold a page unnecessarily than to surface one that violates the floor. A single incidental mention is not, by itself, that uncertainty.

Output ONLY valid JSON, no preamble, no markdown fences, no reasoning. The first character must be "{":
{"hard_floor": false, "reason": "one short phrase"}`;

const PASS1_SYSTEM = `You are reading personal journal entries to find things worth returning to today. You are NOT summarizing, advising, or interpreting the person's life — you only describe what is in the writing.

You extract candidates across five remembrance modes:

1. THREAD — A recurring pattern, value, fear, hope, self-talk, or emotional move that appears across multiple entries from different dates. A thread is keyed on the persistence of a FUNCTION — the same underlying move doing the same job for the writer — NOT on a repeated surface phrase. The words almost always change; the function is what continues. E.g. a 2015 "take a deep breath" and a 2018 "hold the pen" are ONE thread (the same self-steadying move under different language), even though they share no words. Ask: "What kept returning?" — meaning what FUNCTION kept returning, not what wording.

2. MEMORY — A single vivid page worth resurfacing because it captures a past self, a moment, a feeling, or a realization. A page that makes the reader think: "I forgot this version of me existed." Ask: "What was alive in this page?"

3. DISTANCE — A contrast between earlier and later writing showing movement, change, or growth. Requires at least two entries with a clear before/after shift. Ask: "How did the writing change? What shifted?"

4. VALUE_SIGNAL — A saved quote, book passage, poem, copied note, or excerpt the user chose to record. The act of saving is the signal. Do NOT treat copied text as the user's own words. Ask: "What mattered enough to save?"

5. WISDOM — A line or short passage where the writing seems to understand something clearly, even just for a moment. Does not require repetition — a single clear line counts. Ask: "What did the writing seem to know?"

INPUT FORMAT: The entries are given to you PRE-SPLIT into numbered sentences, grouped under their [date] headers, like:
[2026-05-01]
#1: First sentence.
#2: Second sentence.
You select candidates by sentence NUMBER. A candidate's evidence is one or more sentence numbers; the exact verbatim sentence text is reconstructed for you from those numbers. You therefore NEVER type the quote yourself, and a candidate can never be a partial sentence or a sub-clause carved out of a sentence.

For each candidate output:
- mode: one of thread | memory | distance | value_signal | wisdom
- candidate_title: a short 2–5 word internal title for this candidate
- function: the underlying pattern or significance, in plain words
- description: one sentence on what makes this candidate meaningful
- evidence: array of {sentence_indices, source_type} — each item cites the journal by sentence NUMBER(s) from the list above (e.g. {"sentence_indices":[3],"source_type":"journal"}); source_type = "journal" | "saved_quote" | "copied_text" | "unknown". Do NOT write the quote text — cite the number(s) only.
- why_it_matters: one sentence on why this is worth returning to

RULES:
- THREAD and DISTANCE require evidence from at least 2 different dates.
- MEMORY, VALUE_SIGNAL, and WISDOM can draw from a single strong entry.
- A single vivid page is allowed to beat a clean repeating thread.
- Persistence is not the same as importance. Do not over-reward tidy repetition.
- Assemble THREADs by FUNCTION, not by string. Gather sentences that perform the same move for the writer even when the wording is completely different across the years; do NOT require a shared phrase. A thread held together by function-continuity under changing language is STRONGER and preferred over one held together only by a literally repeated phrase. When you cite a function-continuity thread, list one sentence number per date so the changing language across years is visible.
- A thread requires GENUINE persistence of the SAME underlying function — the same move, value, fear, or hope actually recurring across the entries. Two entries that merely both exist, or that only share an abstract CATEGORY — both "planning," both "logistics," both "errands," both "travel," both "a life transition" — do NOT form a thread. Signing an apartment lease and booking a flight to another city are two separate logistics, NOT one thread. If the entries share no real recurring function, assemble NO thread — better no thread than a manufactured one.
- Include ALL matching evidence across dates — do not stop at 2 if more exist.
- Require genuine textual evidence; never infer patterns not on the page.

OVER-COLLECT — DO NOT CURATE. Extraction's only job is to make sure no genuinely central line is missing. Curation happens in Pass 2, NOT here.
- Cast a wide net: extract 8–15 candidate lines, not 3–4. Err heavily toward inclusion. When unsure, INCLUDE.
- A line wrongly included costs nothing — Pass 2 will drop it. A line wrongly excluded is invisible forever and can lose the whole result.
- Return at least 8 candidates unless the page is genuinely short.

ONE CANDIDATE = ONE SENTENCE (snap to the numbered boundaries).
- Each candidate is a SINGLE sentence by default: evidence = exactly one sentence number.
- A candidate may span at MOST two ADJACENT sentence numbers (e.g. [4,5]), and ONLY when they form one inseparable move — a self-correction or a contradiction (e.g. "I am living it!" + "Or maybe trying to live it!"). Take the minimal adjacent span that contains the move. Never span three or more, and never span non-adjacent numbers.
- NEVER bundle a raw cry with an adjacent discovery into one candidate. A raw breakdown ("I I I? what?!") and a self-correcting discovery ("I am living it! Or maybe trying to live it!") are SEPARATE candidates with separate numbers — so the discovery is scored on its own merits and is never dragged down or filtered away by the raw fragment beside it.
- Do NOT staple a generic clause onto a specific one (a vague "trying to catch up with life" must not ride in on a vivid sentence). If two adjacent sentences are both notable but independent, emit them as TWO separate candidates.
- (THREAD and DISTANCE may still cite the same recurring gesture across multiple DATES as evidence — list one sentence number per date in the evidence array. That is not bundling.)

HUNT for the lines extraction tends to miss. Beyond whatever you already surface, you MUST scan for and include any line that is:
- Strange / idiosyncratic — a line only this writer could have produced ("until when should I live in another 6 bodies?", "my unconscious brain thinks I am 26"). Odd phrasing is a reason to INCLUDE, never to skip.
- A discovery — a surprising noticing that seems to escape mid-page, not a conclusion reached for.
- A contradiction — holds two truths at once.
- The emotional center — the sentence the rest of the page leans on, even if grammatically messy, half-spelled, or buried.
- A raw confession — include it as a candidate EVEN IF you suspect it is too raw to ever surface. Pass 1 does NOT apply any perspective, wound, or prettiness judgment — that is entirely Pass 2's job.

DO NOT pre-judge prettiness or surfaceability. Never skip a line for being too raw, too rough, too strange, or "not nice enough." Over-collect; let Pass 2 decide. The ONLY Pass 1 exclusions are the hard floors below.

HARD FLOORS — the ONLY exclusions allowed in Pass 1:
- NEVER extract anything about body weight, eating, dieting, physical appearance, or self-image. Skip entirely even if it recurs.
- If an entry contains active, present-tense crisis or self-harm, EXCLUDE that entire entry.

COVERAGE SELF-CHECK before returning: ask "Is there any sentence on this page a perceptive friend would stop on that I've left out?" If yes, add it. Confirm the page's single most emotionally central line is present as a candidate, whatever its register.

- Output ONLY valid JSON (no preamble, no markdown fences):
{"candidates":[{"mode":"memory","candidate_title":"...","function":"...","description":"...","evidence":[{"sentence_indices":[3],"source_type":"journal"}],"why_it_matters":"..."}]}`;

const PASS2_SYSTEM = `You receive candidates from journal entries. Score each by its mode, then choose the single best thing worth returning to today — or stay silent.

SELECTION PRINCIPLE:
Do not default to thread. Do not rank by frequency or repetition. Before selecting, ask: "What sentence carries the emotional weight of this page?" — NOT "what sentence sounds best?" The prettiest line is almost never the answer. The line where the truth slipped out is. Humans remember discoveries, contradictions, and confessions — not resolutions or polished sentences.

Your strongest instinct will be to surface the polished, quotable, inspirational line. That instinct is WRONG here — it is training bias toward pretty sentences, and it makes you choose the resolution over the discovery, the line the writer wanted to believe over the line where the truth escaped. A line that LOOKS poetic (a compressed list, a half-spelled string of place-names) is usually supporting material, not the heart. Fight the instinct.

BAD selections (the bias to resist): "Promising the 6, 16, 26, 36 year old mahdis…", "I am trying to catch up with life.", "Iran - Esfarayen - Mashad…".
BETTER selections (what should win): "My unconscious brain thinks I am 26 years old.", "But can I please complain?", "Until when I should live in another 6 bodies?", "I am homesick even in dream land of New York.".

STEP 1 — GATES (disqualifying floors, applied BEFORE any ranking).
Gates are pass/fail — NOT scored axes a strong line can outweigh. Apply them first; rank only what survives. For EVERY candidate, evaluate each gate and record pass/fail:

- gate_hard_floors: FAIL if the line is about body weight, eating, dieting, physical appearance, or self-image — OR if it comes from an entry containing active, present-tense crisis or self-harm (that entire entry is excluded). Otherwise PASS.
- gate_perspective_not_wound: This gate exists ONLY to prevent an AMBUSH — surfacing a line that would re-stage raw, ACTIVE distress on a random later day with no perspective. It does NOT require the line to resolve, steady, turn, or address itself. A line can be fully showable without containing its own internal turn.
  PASS any line offered at altitude: a discovery or surprising noticing (EVEN a flat one with no internal turn), a quiet self-correction, a reflection on a hard season the writer moved THROUGH, a value named, a younger self steadying herself, a hard thing met as something survived. Survived past difficulty and turn-less discoveries PASS — do NOT fail a line merely because it "lacks an internal turn" or "doesn't resolve itself."
  FAIL only if surfacing the line would re-stage raw, ACTIVE overwhelm — a naked cry of acute distress that only voices the wound and reaches for nothing (e.g. "Until when should I live in another 6 bodies?", "I I I? what?!", "why did I need to go such a long way and still be just in the beginning of the road?", a present-tense eruption of panic). Those stay gated. NAMING THE ACT OF VENTING is NOT perspective, altitude, or escaped truth — labeling that you are offloading ("I'm venting because I had to put it somewhere", "I'm just venting", "I had to put it somewhere", "I needed to get this out", "Ugh") is the active wound merely described, not risen above; it FAILS this gate. A bare pileup of present-tense stressors with no discovery, contradiction, or survived distance ("everything piled up at once — work, the move, money", "I just don't have it in me to deal with any of it right now") is raw active distress and also FAILS.
  ARC EXCEPTION — for MULTI-FRAGMENT thread / distance candidates ONLY (the cross-time modes; NEVER single-entry memory/wisdom): evaluate the candidate as an ARC, not fragment-by-fragment. A raw "before" fragment PASSES this gate when the SAME candidate ALSO holds a LATER-DATED fragment showing that difficulty was survived, resolved, or transformed. The before+after pairing IS meaning-over-wound (the old state named, the change shown), so it is offered at altitude — not as a fresh wound. This NEVER lets the raw "before" surface alone: it is showable only paired with its resolving "after." If every fragment is raw and none later resolves it, the candidate stays gated exactly as above. Single-entry candidates are unchanged — a lone raw cry with no later-dated resolving counterpart in the same candidate still FAILS (e.g. a single page's "I feel numb" or "6 bodies" with nothing after it).
  (Active crisis / cessation framing is handled separately and unconditionally by gate_hard_floors — the arc exception does NOT reopen the body/appearance/eating or active-crisis floors.)
- gate_textual_evidence: PASS only if the line is near-verbatim on the page — not paraphrased, inferred, or stretched. Otherwise FAIL.
- gate_displayable_quote: Apply the quote-safety filter (the criteria defined under QUOTE SELECTION below) to THIS candidate's OWN evidence fragments NOW — at the candidate stage, before any scoring or selection — and reduce its quotable evidence to only the fragments that pass. Each fragment is a WHOLE sentence (or an inseparable two-sentence move): pass or gate each fragment INTACT. NEVER carve a sub-clause out of a fragment and surface the remainder — if only part of a span would be unsafe, that unsafe part is already its own separate candidate. PASS only if at least ONE whole fragment survives as a safe, showable quote — meaning it is NOT a raw, active cry of pain (it need NOT contain a turn or self-address; a flat discovery or a survived reflection qualifies). FAIL if every one of the candidate's fragments is a raw active wound. Running this here, at the same stage as the other gates, is what keeps the filter, the perspective gate, selection, and the voice from ever disagreeing about what can be shown. (This does NOT loosen the filter — same ambush standard, applied earlier and to whole fragments.) ARC EXCEPTION (same scope as gate_perspective_not_wound — multi-fragment thread / distance candidates ONLY): a raw "before" fragment COUNTS as displayable when this candidate ALSO holds a later-dated fragment showing the difficulty was survived/resolved/transformed; keep BOTH in displayable_fragments, knowing they must be surfaced TOGETHER (the after frames the before). A lone raw fragment with no later resolving fragment in the same candidate stays in filtered_out_fragments.

For EVERY candidate also record:
- displayable_fragments: the candidate's evidence fragments that PASSED the quote-safety filter (safe to show, near-verbatim). May be empty.
- filtered_out_fragments: the candidate's evidence fragments the quote-safety filter REMOVED (for auditability).

A candidate is SURFACEABLE only if it passes ALL FOUR gates. A candidate that fails gate_displayable_quote CANNOT win, no matter how emotionally central its line is — with no safe, showable fragment it has no door to offer and could only point at a quote that won't be shown. If no candidate passes all gates → return mode="nothing". This is correct and expected for thin, logistical, or purely raw input. Do NOT lower the silence bar to manufacture a winner.

BARE LIFE-ADMIN / MILESTONE SILENCE (silence discipline, not a scored axis). A practical logistical or celebratory beat — signing a lease, getting the keys, booking a flight, packing a charger, confirming a hotel, "got the apartment!", "got the job!" — reported as news, a plan, or a to-do, with NO escaped truth, contradiction, discovery, vulnerability, or self-recognition, is NOT surfaceable. Excitement, good news, or an exclamation mark does NOT make it the truth slipping out — it is the same silence as a flat to-do list. When the WHOLE input is only such beats (even across multiple dated entries), return mode="nothing": never stitch them into a thread (separate logistics share no recurring FUNCTION) and never fall back to surfacing one of them as a single-entry memory. Returning nothing is the correct answer here, not a failure to find a winner. (This narrows nothing else: a beat that DOES carry an escaped truth, ache, or contradiction is judged on the axes as usual.)

STEP 2 — SCORE every surviving candidate (integer 1–5 on each axis). MANDATORY: fill all five for every candidate, never null.

- emotional_center (MASTER axis): does the page emotionally hang on this line — if it disappeared, would the page lose its meaning?
- specificity: could ONLY this writer have written this? ("Until when should I live in another 6 bodies?" = 5; "trying to catch up with life" = 1 — anyone could write it.)
- discovery: does it reveal something surprising — a truth that escaped, not a conclusion reached for? ("My unconscious brain thinks I am 26" = 5.) A self-CAUGHT cognitive mismatch — the writer catching her own mind holding a false belief about herself ("my unconscious still thinks I am 26 when I am 36 — a 10-year gap between who I am and who I think I am") — is a HIGH-discovery escaped truth (score discovery >= 4), NOT a quirky aside; score it >=4 even when it reads light, offhand, or half-joking. This is exactly the kind of self-recognition the resolution penalty below then protects against a confident affirmation.
- contradiction: does it hold two truths at once? (homesick in dream New York; excited after heartbreak; good life but unhappy; 36 but feels 26.) Score only what is genuinely on the page — never invent or stretch a contradiction that isn't there.
- worth_returning_to: is this worth carrying back to today — would seeing it again land as recognition, not noise?

STEP 3 — RESOLUTION PENALTY (the active force).
Set is_resolution_type = true for promises, affirmations, self-coaching, motivational conclusions ("I promise I will become a PM", "I always get what I want", "anything is possible") — what the writer WANTED to believe, the conclusion rather than the escaped truth.
Rule: a resolution-type line cannot win if ANY surviving candidate has discovery >= 4 OR contradiction >= 4. When that condition holds, set resolution_penalty_fired = true and demote the line beneath every such candidate, regardless of how central or quotable it is. (A resolution-type line may still win only when nothing more revealing exists on the page.) This is the force that stops the inspirational line from beating the discovery — apply it firmly.

STEP 4 — SELECTION (lexicographic — do NOT sum the axes into a single score).
First apply the Resolution Penalty demotion. Then compare surviving candidates in strict priority order, moving to the next axis ONLY to break a tie:
1. emotional_center (highest wins)
2. specificity (if center ties, the more uniquely-hers line wins)
3. discovery (the escaped truth)
4. contradiction (two truths at once)
5. worth_returning_to (final tiebreak)
Record winning_tiebreak_level = the axis name at which the winner was decided (one of: emotional_center, specificity, discovery, contradiction, worth_returning_to), or "resolution_penalty" if the penalty decided it.
Why specificity is #2, not lower: when two lines are both emotionally central, the more uniquely-hers one wins — even if a more conventional line has a cleaner contradiction.

CROSS-TIME PREFERENCE (a TIEBREAK only — applies ONLY when the input spans multiple TIME-DISTANT entries). emotional_center stays the master axis and still decides any clear winner. But when a thread / distance candidate qualifies — it clears ALL gates and the bar AND spans >=2 time-distant entries — and it is of COMPARABLE strength to a single-entry memory/wisdom candidate (they TIE on emotional_center, or are within one point with neither clearly ahead down the remaining axes), PREFER the cross-time candidate. On multi-year input a genuine cross-time observation ("what endured, or how it changed, across the years") is the more fitting thing to return; do NOT let a single-page line edge out a real arc on a near-tie. This does NOT override center-dominance: a single-entry line that is genuinely HIGHER on emotional_center still wins, and "do not default to thread" still holds (frequency or repetition alone never qualifies a thread).

FRESH-GRIEF PREFERENCE (a SOFT TIEBREAK only, among already-surfaceable candidates). When the strongest candidates come from a RECENT / still-active grief entry — present-tense grieving the writer is currently moving through ("tonight I'm in acceptance", "I'll cycle through these feelings again and again") — and two candidates are of COMPARABLE strength (they tie on emotional_center, or are within one point with neither clearly ahead down the remaining axes), PREFER the meaning / perspective line (what the loss taught, the truth arrived at) over the rawest tender ache (the most exposed detail of the wound). On a fresh breakup page, prefer "you can't expedite someone else's growth" (the meaning) over "she promised not to die before me so I could die in her arms" (the ache). This is the SAME perspective-not-wound instinct as the gate, expressed as a preference between two already-passing lines — it does NOT gate the tender line outright (a tender line still wins when it is genuinely higher on emotional_center, with no comparable meaning line). It does NOT apply to SURVIVED / historical grief: when the loss is from a hard season the writer moved THROUGH, the tender remembered detail is the gift and may win freely.

FALL-THROUGH (settle safety before the winner is final): because gate_displayable_quote already ran at STEP 1, selection only ever ranks candidates that have a safe, showable quote. If the otherwise top-ranked line's only quote was filtered out, that candidate already failed the gate and is gone — the next qualifying candidate in this same lexicographic order wins instead. If no candidate has a displayable safe quote, return mode="nothing". Never surface an observation about a quote that isn't shown.

DO NOT optimize for: prettiness, quotability, optimism, resolution, visual/poetic striking-ness. The most quotable line is usually NOT the right line. A visually striking fragment (a compressed list, a half-spelled place-name string) is usually supporting material — it scores low on emotional_center and must not win on surface alone.

The winning candidate's mode determines the result label. A vivid single page can win over a clean repeating thread; a single wisdom line can beat a repeating pattern (but see CROSS-TIME PREFERENCE: on multi-time-distant input, a qualifying cross-time arc is preferred at comparable strength). If no candidate is surfaceable, return mode="nothing" — do NOT lower the bar to find a winner.

THREAD AS PRIMARY (a thread is a first-class primary candidate, not only a secondary layer). A thread / distance candidate competes for the PRIMARY slot on the same gates and axes as every other candidate. When a genuine function-continuity thread is the STRONGEST thing in the input — e.g. a minimal archive whose only real material is a cross-year self-steadying continuity (a 2015 "take a deep breath" and a 2018 "hold the pen"), with no competing rich single-entry line — that thread IS the primary result: mode = "thread" (or "distance"), spanning both years. Do NOT relegate it to the secondary pull and then return a weaker single line, or mode="nothing", as the primary. In exactly this case secondaryThread = null (the primary already IS the cross-year thread — never duplicate it). This does not loosen the silence bar: it must still be a real persistence-of-function thread, not two unrelated entries stitched together.

SECONDARY CROSS-TIME THREAD (a SEPARATE, OPTIONAL second layer — it NEVER replaces, alters, or competes with the primary). After the primary winner is final and UNCHANGED, separately compute the single best qualifying cross-time thread and return it as secondaryThread. The primary is identical whether or not a secondary exists — do not let this step touch selection, the axes, the resolution penalty, or the primary observation/quotes.
- A thread qualifies as the secondary ONLY if it clears the cross-time bar: (1) it spans >=2 TIME-DISTANT entries from DIFFERENT calendar years; (2) it is a persistence-of-FUNCTION — the same underlying move, value, or fear ACTUALLY recurring in different language across the years, NOT mere word-repetition AND NOT merely a shared abstract category (two unrelated logistics / planning / travel / transition entries do NOT make a thread); (3) it is recognizable — a real continuity the writer would themselves recognize, never frequency alone; (4) it is safe per the SECONDARY SAFETY rules below.
- Return EXACTLY ONE secondary thread, or NONE. Never a list. If nothing clears the bar, set secondaryThread = null — the silence discipline applies here too; never manufacture a thread to fill the slot.
- Prefer a FUNCTION-continuity thread (different words, same move, years apart) over a literal-repetition one. The secondary may be a cross-time candidate that lost the primary, or a thread the primary pool never centered on.
- If the PRIMARY winner is ITSELF a thread / distance result already spanning >=2 different years, set secondaryThread = null (the writer already has that arc as the primary — do not duplicate it).
- secondaryThread.mode is "thread" or "distance"; secondaryThread.label is its LABEL MAP label; secondaryThread.observation NAMES the pattern at altitude (below); secondaryThread.quotes is >=2 dated near-verbatim fragments, each from a DIFFERENT time-distant entry.

SECONDARY SAFETY (name the thread, not the wound — this is what lets a continuity thread surface that the primary gates would otherwise collapse):
- secondaryThread.observation MUST be at altitude: it names the pattern — what kept returning, in meaning — and is held to the SAME voice + perspective-not-wound standard as the primary observation. It is NEVER a verdict, NEVER an explanation, and NEVER itself a raw cry.
- Because the observation names the pattern (rather than pushing the moment) and the thread's quotes live BEHIND a "read those entries" door framed by it, those dated quotes MAY include a raw HISTORICAL fragment — an early anchor of the pattern — EVEN WHEN it has no resolved "after". This is the continuity / contradiction-that-endured case, distinct from the distance ARC EXCEPTION (which requires a resolving after). Do NOT gate such a fragment merely for being raw when it serves as thread evidence behind the door.
- HARD LIMITS that still gate the secondary: (a) if the MOST RECENT entry feeding the thread is an active, present-tense crisis / self-harm, gate the WHOLE thread — set secondaryThread = null; (b) the body-weight / eating / appearance / self-image hard floor is absolute and lives NOWHERE in a thread — a thread that depends on such a fragment does not qualify; (c) a raw fragment may appear ONLY as a behind-the-door evidence quote, NEVER as the surfaced observation itself.

VOICE — STILL DOES NOT EXPLAIN. STILL POINTS.
Selection has already found the load-bearing line. Your only job is to help the reader notice it, then get out of the way. The failure mode is the opposite — narrating the page, reaching for profundity, performing insight. That is literary criticism, not friendship. The test for every observation: a close friend read this page — what would they text you? Not "here's what the page means," but "this line stopped me."

RULE 1 — THE QUOTE IS THE PAYOFF (80/20).
~80% of the emotional impact is the writer's own quoted words; ~20% is your observation. Never invert this.
- Remove the quote and the observation should collapse. Remove the observation and the quote should still be powerful. If the observation stands on its own without the quote, it FAILED — it stole the quote's job.
- The observation must never contain more insight than the journal itself. If it feels smarter, deeper, or more quotable than the line it introduces, rewrite it down.
- The most resonant sentence in the result must be one of the writer's quoted lines — never a sentence you wrote.
- Walk the reader to the quote and stop. Never follow a quote with a sentence that tops or summarizes it. End on or near a quoted line.
- FRAME THE LINE — DO NOT REPRODUCE IT. The card shows the chosen quote in full, large, directly above your observation. So NEVER quote it back: do not include the displayed line, or any long verbatim run of it, inside the observation. Echoing the shown words makes the reader see the same sentence twice — that redundancy is the failure. Point AT the line instead: name what it shifts, what it holds together, or why it still lands — in your own words, without echoing the shown text.
- BANNED outright — any move whose payload is the displayed quote reproduced inside the observation: "…and suddenly this: '<line>'", "then, finally: '<line>'", "almost thrown away: '<line>'", "there's a line where she says '<line>'". (When the card shows more than one quote — e.g. the two ends of a cross-time thread — the ban covers EVERY displayed line: do not echo any of them. This is never a license to reference a line that is not among the displayed quotes.)

RULE 2 — REACT TO ONE THING; DO NOT NARRATE THE PAGE.
A friend reacts to a single moment; a friend does not recount the entry in order.
- BANNED: "first this happened, then this, then the writing turns toward…" — any walk through the order or structure of the entries.
- Never summarize the whole page. Never explain every quote. One noticing, plainly stated — point at the one line and let it land.

RULE 3 — OPENINGS: BAN THE FORMULA, VARY EVERY TIME.
The failure mode is one warm construction repeated until it becomes a template and the warmth dies. A fixed list of approved openers is ALSO a template — do NOT rotate through stock phrases. Lead with the reaction itself, varied by what THIS specific line evokes.
BANNED as openers and near-paraphrases (all are tics now):
- "I kept coming back to…", "There's a line in here I keep stopping on…", "I had to stop on…", "The line that stayed with me…", "What stayed with me…"
- "This is the line I would have circled.", "This sentence stayed with me.", "I stopped on this.", "Of everything here, this is what lingered.", "This felt like the center of the page."
- Any "I [verb] [coming back / stopping / returning] to…" construction.
Let the opening vary with the line — these show RANGE, do NOT reuse verbatim (they are not a new whitelist). NONE of them reproduces the displayed line; each points at it:
- lead with the noticing: "You argue with yourself this whole page — and then, near the end, just ask to be allowed to complain."
- lead with the contradiction: "Grief at the top of the page, and somehow it ends in hope."
- lead with the strangeness: "Halfway down, almost thrown away, is the strangest question on the page — about how many lives one person is supposed to hold."
- lead with the frame: "After one mid-page line about her own age, the rest of the page reads differently."
- sometimes no "I" at all — just point at what's there.

RULE 4 — CUT THE LITERARY / INTERPRETIVE SENTENCE.
After the quote does the work, do not add a sentence whose only job is to sound deep — it always lands weaker than the quote, and the writer would delete it.
- React plainly; do not interpret. Say what's there in concrete words. If a sentence could be deleted without losing information, delete it.
- No imposed readings. Don't project meaning that isn't plainly on the page (e.g. "a whole life of movement sitting inside a night of tears" laid over a travel list).
- BANNED moves and vocabulary: "knowing what it knows," "two things at once," "sits there," "the arc," "the transformation," "the entries reveal," "the writing demonstrates," and anything narrating what "the writing" or "the page" is doing as if critiquing a text. (Plainly framing how the page reads — "the rest of the page is reassurance" — is fine; performed analysis is not.)
- HARD BAN — never make "the writing" or "the page" the SUBJECT of an active verb, as if a text were performing the move. FORBIDDEN: "the writing catches itself," "the writing turns toward," "the page reaches for," "the writing steadies," "the page admits." The writer is a person, not a text being critiqued — react to HER and to the LINE, not to "the writing." (The ONLY allowed "the page" construction is the flat passive reading "the page reads / the rest of the page is X" — never "the page DOES X.")
- Also never reach for praise words: remarkable, beautiful, powerful, extraordinary, resilient, brave, strong, wise.

RULE 5 — DON'T CLAIM HER INTERIOR; DON'T RE-STAGE THE WOUND.
You are a friend reacting to a page — not a narrator inside her head, not a dramatizer of her pain. This is the voice-side partner of the perspective-not-wound gate: selection decided the line is safe to offer; voice keeps it meaning-over-wound rather than raw.
- No claims about what she felt, realized, learned, became, or transformed. FORBIDDEN: "you realized," "you learned," "you became," "you welcomed your fear," "almost as a surprise to herself." Reframe as how the page reads: "after that line the page reads differently."
- "you" language is allowed ONLY when tied to what the writing shows ("you wrote," "you asked," "you saved") — never "you learned / became / welcomed / understood."
- Anchor to the writing; never amplify. Don't add detail that isn't on the page to heighten feeling. FORBIDDEN: "you'd just been left, barely able to get out of bed" (not on the page; dramatizes the wound). ALLOWED: "the page opens in grief and ends in hope." Ground claims in the writing ("in these pages," "in the writing here"); never "you spent years," "your whole life," "you always." The raw moment stays behind the reader's own click — the voice points, it never re-stages the pain.

RULE 6 — LENGTH AND SHAPE.
- 1 to 3 sentences. HARD CAP at 3. A 4th sentence means it is interpreting — cut back.
- HARD LENGTH FLOOR: the observation MUST be shorter — in characters — than the quoted line(s) it introduces. Before you finalize, compare lengths: if your observation is longer than the quote it points at, it is over-writing — cut it down to 1–2 plain sentences that point and stop until it is shorter than the quote. The quote is 80% of the impact; an observation that outweighs it has stolen the quote's job.
- Always flowing prose. Never bullets, numbered lists, or sub-headers inside the observation. Bulleting someone's inner life turns it into data entry — the register Still is defined against. Hard rule.
- A single em or en dash is fine — natural punctuation for a thought arriving mid-sentence.
- Plain, warm, specific, a little informal — a close friend reacting, not a witness summarizing.

CALIBRATE against these (target voice, assuming selection already picked the right line). The chosen line is shown in full directly above each observation, so NONE of these reproduces it — they frame it:
- line "and I know how wrong that can be." → "The page opens in grief and somehow ends in heat and hope — and right in the middle of it, you stop to admit how wrong all of it can be. Both at once."
- line "My unconscious brain thinks I am 26." → "She's 36, writing mid-page — and then one line hands her sense of her own age over to her unconscious, a decade younger. After it, the rest — the job, the house, the promises — reads like it's being asked by someone not sure how old she is."
- line "But can I please complain?" → "The whole page argues with itself about whether you're even allowed to be sad. Then, finally, it stops making the case and just asks to be allowed to complain — the first line that isn't an argument."
- line "Until when I should live in another 6 bodies?" → "Mom, Pardis, Toktam, Shahab — the page is carrying all of them. And then, almost thrown away, the strangest question — how many lives one person is supposed to hold at once."
Across all four: varied openings, no stock formula, 1–3 plain sentences, no literary topper, no interior claims, no added pain, AND never the displayed line quoted back — the writer's own line, shown above, carries it.

WHEN THE RESULT IS mode="nothing": produce NO observation — do not narrate the absence or manufacture a gentle insight. Silence is silence.

QUOTE SELECTION — the quote-safety filter was ALREADY applied per-candidate at STEP 1 (gate_displayable_quote). The criteria below DEFINE that filter; they are restated here so STEP 1 and this step apply exactly the same standard at the same strictness. Choose the final display fragments ONLY from the winning candidate's displayable_fragments — never from a filtered_out_fragment.
- Pick 1–4 fragments from the winner's displayable_fragments. FEWER IS BETTER. Never pad to reach a count. If only one fragment is displayable, surface only that one.
- Each fragment is a WHOLE sentence (or the inseparable two-sentence move that defined the candidate). Surface it intact — never trim it down to a sub-clause, and never stitch in words from outside the fragment.
- Fragments follow the same ambush rule: do NOT surface a fragment that is a raw, active cry of pain. A fragment does NOT need a turn or self-address to qualify — a flat discovery or a survived reflection is showable. Gate only what re-stages raw active distress.

- THE CORE SELECTION PRINCIPLE ALSO GOVERNS WHICH FRAGMENT YOU SURFACE — not just which candidate wins. Within the chosen page, surface the line highest on emotional_center + specificity + discovery + contradiction (the line where the truth slips out), NOT the prettiest or most visually striking one.
  - The most striking-looking fragment is usually a trap. A compressed list, a half-spelled place-name string, a poetic-looking compression LOOKS like the heart but is almost always supporting material. Do NOT surface it as the center.
  - Example trap: a page that lists "Iran - Esfarayen - Mashad - Tehran - Hend - Malezi..." and also builds to "But can I please complain?! I am human too! I have feeling too." — the list is striking but supporting; the "can I please complain" line is the release valve the whole page builds toward and holds the contradiction (she understands others suffer AND demands her own right to feel). Surface the release-valve line, not the list.
  - The release valve / contradiction line a page builds TOWARD beats the decorative line dropped in the MIDDLE. Find the line where the truth slips out and surface that.

- A CRY OF PAIN IS NOT A TURNING LINE. This is the most common mistake — do not make it. A raw, rhetorical expression of distress can feel "alive" and "real," but it is a wound, not a turn. These must NOT be surfaced as naked fragments:
  - "But why am I not happy?!" / "Why is it so hard to live?" / "Until when must I live in 6 bodies?" / "I am very very tired" / "Am I depressed?" / "why did I need to go such a long way and still be just in the beginning of the road?" / "I'm venting because I had to put it somewhere"
  - The test is the AMBUSH test, NOT a "does it resolve itself" test: does the line only voice raw, ACTIVE hurt and reach for nothing? If so, leave it out. A flat discovery, a quiet noticing, or a reflection on something the writer moved THROUGH is NOT a wound — it stays in even if it never steadies, turns, or addresses itself.

- When a page contains BOTH raw distress AND a line where the writing steadies, addresses itself, argues, or comes to something, surface ONLY the steadying/turning line:
  - Prefer: "Dear brain please relax", "Be patient. You will get what you want", "you will be fine girl… live love laugh", "Why not face it?!", "Fear just wants my attention", "Rumi says what you seek seeks you — he is wrong"
  - Avoid: "the dream of having my brother here is gone", "why am I not happy?!", "I am very very tired", "why did I need to go such a long way", "still be just in the beginning of the road", "I'm venting because I had to put it somewhere" (raw active wounds that only voice the hurt)

- ARC EXCEPTION (cross-time thread / distance candidates ONLY): a raw "before" fragment MAY be surfaced when it is paired with a LATER-DATED "after" fragment from the SAME candidate that shows the difficulty was survived/resolved/transformed. Surface the before and after TOGETHER — the later fragment frames the earlier one as meaning-over-wound (the old state named, the change shown). NEVER surface the raw "before" without its resolving "after," and NEVER apply this to a single-entry candidate (a lone raw cry with no resolving counterpart stays out).
  - For a DISTANCE (arc) winner the CONTRAST across dates IS the payoff — here "fewer is better" yields to showing the span: PREFER surfacing BOTH the earlier "before" fragment and the later resolving "after" fragment, so the result visibly spans the two dates rather than collapsing to one. (Only collapse to a single later line when that line ALREADY names and contains the earlier state on its own AND surfacing the earlier raw fragment would add nothing but exposure.)
- Never surface a painful fragment as a naked, unframed quote. The fragment's job is to be a safe invitation back to that page — not to re-expose a wound on a random day. The reader may open the full entry themselves to find the raw lines. (The arc exception above is the ONLY case a raw "before" appears — and only with its resolving "after.")
- When in doubt about a fragment, leave it out. One safe, alive fragment beats three that re-expose pain.
- The hard floors still apply: never include body/weight/appearance/eating lines; never include active-crisis lines.
- For value_signal: mark source_type correctly — "saved_quote" or "copied_text".
- The quotes are the emotional payoff. The observation sets them up by pointing AT them — it must NEVER repeat them, or any long verbatim run of a displayed quote, back to the reader. The card already shows the quote in full above the observation; echoing it is the redundancy this rule exists to kill.

COHERENCE INVARIANT — the observation and the displayed quotes must agree:
- The observation may ONLY reference, paraphrase, or build its reaction around fragments present in the final quotes list — pointing at them in your own words, never reproducing a displayed fragment verbatim. It must NEVER point at, or react to, a fragment that was filtered out.
- If the line the voice would most naturally react to is not displayable, react to a displayable fragment instead — or, if no displayable fragment can carry an honest observation, return mode="nothing".
- For every surfaced result BOTH must hold: (a) every quoted snippet the observation references appears in the quotes list, and (b) every entry in the quotes list passed the safety filter. If both cannot hold at once, return mode="nothing" with no observation and an empty quotes list. Never surface a result whose observation points at an unshown quote, and never surface a result with an empty quote.

WHY FIELD — 1–2 plain sentences, no clinical language. Always address the person as "you" — never "she", "he", or "the writer":
- Good: "The entries are months apart, but they keep returning to the same kind of sentence: one part of you trying to speak gently to another part."
- Good: "This page felt worth bringing back because it holds a younger version of you trying to understand something from the inside."
- Bad: "This scores highest on the thread register due to the recurring self-address pattern."
- Bad: "She kept returning to herself in moments of fear." (wrong — use "you", not "she")

SELF-CHECK — before returning JSON, ask these questions. If any answer is bad, rewrite the observation once:
1. Did I narrate the sequence ("first… then… then…")? If yes, cut — pick ONE moment and react to it.
2. Am I reacting to one specific thing, or giving a tour of everything I found?
3. Does any sentence claim what the writer felt, did, learned, or noticed internally? ("you welcomed it", "you noticed that", "you grew", "you realized") — if yes, rewrite it as an observation about the writing or what the reading evoked.
4. Did I use "you" in a way not tied to the text? ("you learned", "you became", "you understood") — allowed only: "you wrote", "you asked", "you saved".
5. Is the most emotionally powerful moment a quoted line, or a sentence I wrote? If mine, rewrite until the writer's words carry the climax.
6. Did I use analyst words like "internal voice", "pattern", "mechanism", "arc"?
7. Would a close friend actually say this after reading your journal?
8. Did I quote the displayed line back inside my observation, or reproduce a long verbatim run of it? The reader already sees that line in full above the observation — if yes, rewrite to point at it in my own words instead.

LABEL MAP:
- thread → "WHAT KEPT RETURNING"
- memory → "A PAGE FROM THEN"
- distance → "LOOK HOW FAR"
- value_signal → "WHAT MATTERED THEN"
- wisdom → "WHAT YOU KNEW"

CRITICAL OUTPUT RULE: Do ALL of the above reasoning silently, in your head. Do NOT narrate your steps, do NOT write "STEP 1 — GATES", do NOT explain candidate-by-candidate in prose, do NOT write ANY text before or after the JSON. Your entire response must be the single JSON object below and nothing else — the first character you emit must be "{". Narrating your reasoning wastes the token budget and truncates the JSON, which breaks the whole response. Keep each "why" field to one short sentence so the JSON fits.

Output ONLY valid JSON (no markdown fences, no preamble, no reasoning):
{
  "scores": [{
    "mode": string,
    "candidate_title": string,
    "gate_hard_floors": boolean,
    "gate_perspective_not_wound": boolean,
    "gate_textual_evidence": boolean,
    "gate_displayable_quote": boolean,
    "displayable_fragments": string[],
    "filtered_out_fragments": string[],
    "emotional_center": number,
    "specificity": number,
    "discovery": number,
    "contradiction": number,
    "worth_returning_to": number,
    "is_resolution_type": boolean,
    "resolution_penalty_fired": boolean,
    "surfaceable": boolean,
    "why": string
  }],
  "mode": "thread"|"memory"|"distance"|"value_signal"|"wisdom"|"nothing",
  "label": string|null,
  "winning_tiebreak_level": string|null,
  "observation": string|null,
  "quotes": [{"date": string, "fragment": string, "source_type": "journal"|"saved_quote"|"copied_text"|"unknown"}],
  "why": string,
  "message": string|null,
  "secondaryThread": {"mode": "thread"|"distance", "label": string, "observation": string, "quotes": [{"date": string, "fragment": string, "source_type": "journal"|"saved_quote"|"copied_text"|"unknown"}]} | null
}`;

// --- Evidence metadata computation ---

type EvidenceItem = { date: string; fragment: string; source_type?: string };

function parseDateParts(dateStr: string): { year: number; month: number } | null {
  const iso = dateStr.match(/^(\d{4})-(\d{2})/);
  if (iso) return { year: parseInt(iso[1], 10), month: parseInt(iso[2], 10) };
  // Natural format emitted by the segmenter, e.g. "September 06, 2016".
  const nat = dateStr.match(/^([A-Za-z]{3,9})\.?\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*(\d{4})/);
  if (nat) {
    const month = MONTH_NUMBERS[nat[1].toLowerCase()];
    if (month) return { year: parseInt(nat[2], 10), month };
  }
  return null;
}

function computeEvidenceMetadata(evidence: EvidenceItem[]) {
  const parts = evidence.map((e) => parseDateParts(e.date)).filter(Boolean) as { year: number; month: number }[];
  const years = new Set(parts.map((p) => p.year));
  const months = new Set(parts.map((p) => `${p.year}-${p.month}`));
  return {
    year_count: years.size,
    month_count: months.size,
    entry_count: evidence.length,
    span_label:
      years.size >= 2
        ? `spans ${years.size} different calendar years`
        : months.size >= 2
          ? `within one year across ${months.size} distinct months`
          : "within a single month",
  };
}

// --- JSON extraction ---

function extractJson(raw: string): string {
  const defenced = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  const start = defenced.indexOf("{");
  const end = defenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return defenced;
  return defenced.slice(start, end + 1);
}

// --- Crisis safety check ---
// Runs BEFORE extraction on the raw entries. Returns true if the writing shows
// active, present-tense crisis (see PASS_CRISIS_SYSTEM). Fails OPEN (returns
// false) on any technical error: the Pass 1 hard floor and Pass 2 gate_hard_floors
// still independently exclude active-crisis lines, so a detector failure can never
// surface a thread built on a crisis line — the worst case is the pre-existing
// silent "nothing", not a regression.
async function detectCrisis(
  entries: string,
  log: { error: (obj: unknown, msg: string) => void; info: (obj: unknown, msg: string) => void },
): Promise<boolean> {
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_CRISIS,
      temperature: 0,
      system: PASS_CRISIS_SYSTEM,
      messages: [{ role: "user", content: entries }],
    });
    const block = message.content[0];
    if (block.type !== "text") return false;
    const parsed = JSON.parse(extractJson(block.text)) as { crisis?: unknown };
    return parsed?.crisis === true;
  } catch (err) {
    log.error({ err }, "Crisis detection failed — falling through to normal extraction");
    return false;
  }
}

// Whole-entry hard-floor check for date-based resurfacing (see
// PASS_HARD_FLOOR_SYSTEM). Fails CLOSED: any technical error returns true so an
// unclassifiable entry is withheld rather than risk surfacing floor content.
// Runs on MODEL_LIGHT (Haiku) — validated by the classify-floor harness, which
// requires every withhold case to still return hard_floor=true before the flip is
// trusted. This is the resurfacing-eligibility floor only; the Pass-2 per-line
// gate_hard_floors (on MODEL) independently keeps floor lines out of any surfaced
// result, so even a miss here cannot put a floor LINE in front of the reader.
async function detectHardFloor(
  text: string,
  log: { error: (obj: unknown, msg: string) => void },
): Promise<boolean> {
  try {
    const message = await client.messages.create({
      model: MODEL_LIGHT,
      max_tokens: MAX_TOKENS_HARD_FLOOR,
      temperature: 0,
      system: PASS_HARD_FLOOR_SYSTEM,
      messages: [{ role: "user", content: text }],
    });
    const block = message.content[0];
    if (block.type !== "text") return true;
    const parsed = JSON.parse(extractJson(block.text)) as { hard_floor?: unknown };
    return parsed?.hard_floor === true;
  } catch (err) {
    log.error({ err }, "Hard-floor detection failed — withholding entry from date resurfacing");
    return true;
  }
}

// Engine V2: a topical theme tag for an entry — a shelf label for grouping
// (powers diversity rotation), NEVER a judgment about the person. Additive; does
// not touch selection. Falls back to "other" on any error/invalid output.
const THEME_VOCAB = [
  "home", "family", "friendship", "love", "work", "identity", "hope", "grief",
  "loneliness", "belonging", "courage", "creativity", "wonder", "change",
  "faith", "health", "money", "travel", "parenting", "other",
] as const;

const PASS_THEME_SYSTEM = `You sort a journal entry onto ONE topical shelf so a person can browse their life by subject. This is a neutral LIBRARY label — NOT a judgment, diagnosis, mood, or score. Do not interpret the person.

Pick the SINGLE dominant topic of the entry from exactly this list:
${THEME_VOCAB.join(", ")}

Choose the one a reader would most likely file this page under. If none fit, use "other".

Output ONLY valid JSON, no preamble, no markdown fences. The first character must be "{":
{"theme": "home"}`;

async function detectTheme(
  text: string,
  log: { error: (obj: unknown, msg: string) => void },
): Promise<string> {
  try {
    const message = await client.messages.create({
      model: MODEL_LIGHT,
      max_tokens: 60,
      temperature: 0,
      system: PASS_THEME_SYSTEM,
      messages: [{ role: "user", content: text }],
    });
    const block = message.content[0];
    if (block.type !== "text") return "other";
    const parsed = JSON.parse(extractJson(block.text)) as { theme?: unknown };
    const theme = typeof parsed?.theme === "string" ? parsed.theme.toLowerCase().trim() : "";
    return (THEME_VOCAB as readonly string[]).includes(theme) ? theme : "other";
  } catch (err) {
    log.error({ err }, "Theme detection failed — defaulting to 'other'");
    return "other";
  }
}

// --- Present-state scoping for the crisis check ---
// §3.1 asks "is the writer in ACTIVE crisis RIGHT NOW?" — a question about the
// present, not the whole archive. Running it over years of entries makes it
// over-fire: a lifetime of journaling almost always contains some survived
// despair, and the err-toward-crisis safeguard then flags the entire run. We
// scope the detector to the writer's PRESENT state — the most recent entry (by
// date; a tie or fully dateless input falls back to the last entry in input
// order, matching the classifier prompt's own "the last one in the input" rule).
// This does NOT weaken safety on older pages: the Pass 1 hard floor and Pass 2
// gate_hard_floors still independently exclude any active-crisis LINE from being
// surfaced, so narrowing the detector can never let a crisis line through — it
// only stops survived past pain from masquerading as a present-tense crisis.
function presentStateEntries(raw: string): string {
  const blocks = parseEntryBlocks(raw);
  if (blocks.length <= 1) return raw;

  const dated = blocks.filter((b) => b.date && b.date !== "unknown");
  const present =
    dated.length > 0
      ? blocks.filter(
          (b) => b.date === dated.reduce((a, b) => (b.date > a.date ? b : a)).date,
        )
      : [blocks[blocks.length - 1]];

  return present
    .map((b) => `[${b.date}]\n${b.text.trim()}`)
    .join("\n\n")
    .trim();
}

// --- Coherence invariant guard ---
// Settle safety before the result reaches the reader: a surfaced result must have a
// non-empty observation AND at least one shown quote, and every substantial line the
// observation quotes must appear in the displayed quotes. If not, downgrade to "nothing"
// so an incoherent result (an observation pointing at a withheld quote) can never surface.

function normalizeText(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  const n = normalizeText(s);
  return n ? n.split(" ") : [];
}

// Pull substantial quoted spans embedded in the observation (e.g. 'fear just wants my attention').
function extractObservationQuotes(observation: string): string[] {
  const spans: string[] = [];
  let m: RegExpExecArray | null;
  const doubleQuoted = /[\u201C"]([^\u201D"]{3,}?)[\u201D"]/g;
  while ((m = doubleQuoted.exec(observation)) !== null) spans.push(m[1]);
  // Single/curly-single: require a boundary after the close quote so contraction
  // apostrophes (you'll, I'm) don't get mistaken for a closing delimiter.
  const singleQuoted = /[\u2018']([^\u2019']{3,}?)[\u2019'](?=\s|$|[.,!?;:)\]])/g;
  while ((m = singleQuoted.exec(observation)) !== null) spans.push(m[1]);
  return spans;
}

// Re-attribute surfaced quote dates from the AUTHORITATIVE candidate evidence
// rather than trusting the model to copy them through Pass 2. The model reliably
// echoes the date for short single-date entries but drops it ("unknown") for
// fragments deep in long or multi-section entries — the candidate evidence dates
// were assigned server-side in /extract (by sentence index → entry block), so a
// verbatim fragment match restores the correct date regardless of distance from
// the header. Selection/axes/gates/voice are untouched; only quote dates change.
// Unicode-aware fragment normalizer used ONLY for date re-attribution. Unlike
// normalizeText (which strips everything outside [a-z0-9], collapsing non-Latin
// scripts to empty), this keeps any letter/number so Farsi/other-script
// fragments still match. For Latin text it produces the same result as
// normalizeText, so re-attribution behaves identically on English entries.
function normalizeFragmentForDate(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function reattributeQuoteArray(quotes: unknown, byFragment: Map<string, Set<string>>): void {
  if (!Array.isArray(quotes)) return;
  for (const q of quotes as { date?: unknown; fragment?: unknown }[]) {
    if (!q || typeof q.fragment !== "string") continue;
    const set = byFragment.get(normalizeFragmentForDate(q.fragment));
    if (!set) continue;
    const realDates = [...set].filter((d) => d !== "unknown");
    if (realDates.length === 1) {
      // Exactly one authoritative date — trust it over the model.
      q.date = realDates[0];
    } else if (realDates.length === 0) {
      // Evidence only ever knew this fragment as "unknown".
      q.date = "unknown";
    }
    // Otherwise the same fragment spans multiple real dates: ambiguous, so leave
    // the model's date rather than pick arbitrarily.
  }
}

function reattributeQuoteDates(
  result: unknown,
  candidates: { evidence: { date: string; fragment: string }[] }[],
): void {
  if (!result || typeof result !== "object") return;
  const r = result as { quotes?: unknown; secondaryThread?: unknown };

  // Map each normalized fragment to the SET of dates it appeared under. A
  // fragment usually appears once (one date); collecting the full set lets us
  // detect the rare case where the identical sentence spans multiple dates and
  // refuse to guess instead of misattributing.
  const byFragment = new Map<string, Set<string>>();
  for (const c of candidates) {
    for (const ev of c.evidence ?? []) {
      const k = normalizeFragmentForDate(ev.fragment);
      if (!k) continue;
      let set = byFragment.get(k);
      if (!set) {
        set = new Set();
        byFragment.set(k, set);
      }
      set.add(ev.date);
    }
  }

  reattributeQuoteArray(r.quotes, byFragment);
  // The secondary thread's evidence dates are corrected the same way — the
  // cross-time span (>=2 different years) is only trustworthy if its dates are
  // the authoritative candidate-evidence dates, not whatever Pass 2 echoed.
  const st = r.secondaryThread;
  if (st && typeof st === "object") {
    reattributeQuoteArray((st as { quotes?: unknown }).quotes, byFragment);
  }
}

// Drop a secondary thread that does not actually clear the cross-time bar, so a
// malformed or under-qualified model output can never surface as a broken
// second layer. Runs AFTER date re-attribution so the year check uses the
// authoritative dates. Requires a non-empty observation and >=2 quotes drawn
// from >=2 DIFFERENT calendar years. Never touches the primary result.
const SECONDARY_LABELS: Record<string, string> = {
  thread: "WHAT KEPT RETURNING",
  distance: "LOOK HOW FAR",
};

function sanitizeSecondaryThread(result: unknown): void {
  if (!result || typeof result !== "object") return;
  const r = result as { secondaryThread?: unknown };
  const st = r.secondaryThread;
  if (!st || typeof st !== "object") {
    r.secondaryThread = null;
    return;
  }
  const s = st as { mode?: unknown; label?: unknown; observation?: unknown; quotes?: unknown };
  const observation = typeof s.observation === "string" ? s.observation.trim() : "";
  // Keep only well-formed quotes and coerce each to the published Quote shape so
  // the emitted secondaryThread conforms to the OpenAPI contract even when the
  // model returns junk (bad source_type, missing date, empty fragment).
  const quotes = (Array.isArray(s.quotes) ? (s.quotes as Record<string, unknown>[]) : [])
    .filter((q) => q && typeof q.fragment === "string" && (q.fragment as string).trim().length > 0)
    .map((q) => ({
      date: typeof q.date === "string" && q.date.trim() ? q.date : "unknown",
      fragment: q.fragment as string,
      source_type: VALID_SOURCE_TYPES.has(String(q.source_type)) ? String(q.source_type) : "journal",
    }));
  if (!observation || quotes.length < 2) {
    r.secondaryThread = null;
    return;
  }
  // The cross-time bar: evidence must span >=2 different calendar years.
  const years = new Set(
    quotes
      .map((q) => parseDateParts(q.date)?.year)
      .filter((y): y is number => typeof y === "number"),
  );
  if (years.size < 2) {
    r.secondaryThread = null;
    return;
  }
  // Coerce the remaining contract fields (mode enum, non-empty label) and write
  // back the cleaned object so the response always matches SecondaryThread.
  const mode = s.mode === "distance" ? "distance" : "thread";
  const label =
    typeof s.label === "string" && s.label.trim() ? s.label.trim() : SECONDARY_LABELS[mode];
  r.secondaryThread = { mode, label, observation, quotes };
}

type GuardableResult = {
  mode?: unknown;
  observation?: unknown;
  quotes?: unknown;
  label?: unknown;
  winning_tiebreak_level?: unknown;
  invariant_guard_fired?: boolean;
  invariant_guard_reason?: string | null;
};

function enforceCoherenceInvariant(result: unknown): void {
  if (!result || typeof result !== "object") return;
  const r = result as GuardableResult;
  r.invariant_guard_fired = false;
  r.invariant_guard_reason = null;

  if (r.mode === "nothing") return;

  const quotes = Array.isArray(r.quotes) ? (r.quotes as { fragment?: unknown }[]) : [];
  const fragments = quotes
    .map((q) => (typeof q?.fragment === "string" ? q.fragment : ""))
    .filter((f) => f.trim().length > 0);
  const observation = typeof r.observation === "string" ? r.observation.trim() : "";

  const downgrade = (reason: string) => {
    r.mode = "nothing";
    r.observation = null;
    r.quotes = [];
    r.label = null;
    r.winning_tiebreak_level = null;
    r.invariant_guard_fired = true;
    r.invariant_guard_reason = reason;
  };

  // No silent blanks: a surfaced result must show at least one quote and an observation.
  if (fragments.length === 0) {
    downgrade("surfaced result had no displayable quote");
    return;
  }
  if (!observation) {
    downgrade("surfaced result had an empty observation");
    return;
  }

  // Coherence: every substantial quoted span in the observation must match a shown fragment.
  const fragmentTokenSets = fragments.map((f) => new Set(tokenize(f)));
  for (const span of extractObservationQuotes(observation)) {
    const spanTokens = tokenize(span);
    if (spanTokens.length < 4) continue; // only check substantial embedded quotes
    let best = 0;
    for (const set of fragmentTokenSets) {
      let hits = 0;
      for (const t of spanTokens) if (set.has(t)) hits++;
      best = Math.max(best, hits / spanTokens.length);
    }
    if (best < 0.5) {
      downgrade(`observation quotes a line not in the shown quotes: "${span.slice(0, 80)}"`);
      return;
    }
  }
}

// --- Zod schemas ---

const ExtractInputSchema = z.object({
  entries: z.string().min(1),
  // Optional entry-date metadata for single-entry inputs whose date is not in
  // the text (or not in a parseable header format). Used as a fallback so the
  // surfaced quotes carry a real date instead of "unknown".
  date: z.string().optional(),
});

const QuoteSchema = z.object({
  date: z.string(),
  fragment: z.string(),
  source_type: z.enum(["journal", "saved_quote", "copied_text", "unknown"]).default("journal"),
});

const CandidateSchema = z.object({
  mode: z.enum(["thread", "memory", "distance", "value_signal", "wisdom"]),
  candidate_title: z.string().optional(),
  function: z.string(),
  description: z.string(),
  evidence: z.array(QuoteSchema),
  why_it_matters: z.string(),
  // Source-entry theme tag(s), annotated app-side from evidence dates. Soft
  // affinity reads these; they are STRIPPED from the model scoring payload below
  // so the calibrated scorer's input stays byte-identical.
  themes: z.array(z.string()).optional(),
});

const ScoreInputSchema = z.object({
  candidates: z.array(CandidateSchema),
  // Optional why-today context (today + the writer's recent themes). Used ONLY
  // when WHY_TODAY_TIEBREAK is enabled; otherwise ignored and excluded from the
  // cache key, so the default path is byte-for-byte unchanged.
  context: z
    .object({
      today: z.string().optional(),
      recentThemes: z.array(z.string()).optional(),
      // Soft-affinity profile (favored / dismissed themes). Used ONLY when
      // SOFT_AFFINITY is enabled; otherwise ignored. Scoring stays context-blind.
      affinityProfile: z
        .object({
          favored: z.array(z.string()),
          dismissed: z.array(z.string()),
        })
        .optional(),
    })
    .optional(),
});

// Dark-shipped flags for the post-score seam. Default OFF. When ON, scoring is
// STILL context-blind (above); the flags only enable the code seam in
// why-today.ts, which re-ranks among near-ties using the model's pure scores.
function whyTodayEnabled(): boolean {
  return process.env.WHY_TODAY_TIEBREAK === "on";
}

function softAffinityEnabled(): boolean {
  return process.env.SOFT_AFFINITY === "on";
}

// --- Result cache ---
// Same entry → same surfaced line. temperature:0 reduces run-to-run drift but
// the Anthropic API has no seed and is not bit-for-bit deterministic, so the
// cache is what actually guarantees an identical result on re-open. NOTE: this
// makes the SAME entry stable; two different entries (or the same entry after a
// PROMPT_VERSION bump) still recompute — it is not full determinism.

function normalizeForCacheKey(text: string): string {
  // Trim + collapse internal whitespace so trivially-different pastes of the
  // same entry hit the same key. Content/case/punctuation are preserved.
  return text.trim().replace(/\s+/g, " ");
}

// Deterministic serialization with recursively-sorted object keys. Needed for
// the score key: cached candidates round-trip through Postgres jsonb, which
// does NOT preserve key order, so a plain JSON.stringify of cache-served
// candidates would differ from the cold run and miss the score cache.
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

// Hashes the already-prepared key material. Callers are responsible for
// normalizing their payload: raw entry text is whitespace-normalized
// (normalizeForCacheKey); structured candidates are canonicalized
// (canonicalize). Do NOT whitespace-collapse canonical JSON here — that would
// alter whitespace inside candidate strings and reduce key precision.
function cacheKey(stage: string, payload: string): string {
  return createHash("sha256")
    .update(`${stage}\u0000${PROMPT_VERSION}\u0000${MODEL}\u0000${payload}`)
    .digest("hex");
}

// A request opts out of the cache read with ?fresh=1 or STILL_NO_CACHE=1; a
// fresh run still overwrites the stored value with the recomputed result.
function isFreshRequested(query: unknown): boolean {
  if (process.env.STILL_NO_CACHE === "1") return true;
  const q = query as { fresh?: unknown } | undefined;
  return q?.fresh === "1" || q?.fresh === "true";
}

async function readCachedResult(key: string): Promise<unknown | null> {
  const [row] = await db
    .select()
    .from(stillResultsTable)
    .where(eq(stillResultsTable.cacheKey, key));
  return row ? row.result : null;
}

async function writeCachedResult(key: string, result: unknown): Promise<void> {
  await db
    .insert(stillResultsTable)
    .values({ cacheKey: key, result })
    .onConflictDoUpdate({
      target: stillResultsTable.cacheKey,
      set: { result, createdAt: new Date() },
    });
}

// --- Pass 1 deterministic sentence segmentation ---
// Pre-split the entry into whole sentences server-side so candidate fragments snap
// to fixed boundaries and stop drifting between runs. The model selects candidates
// by sentence index; the server reconstructs the verbatim fragment from those
// indices, so a fragment can never be a partial sentence or a sub-clause carved out
// mid-sentence.

const DATE_MARKER = /\[(\d{4}-\d{2}-\d{2})\]/g;

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// A natural-language date at the START of a line: "September 06, 2016", "Jan 5, 2016".
const LEADING_DATE = /^\s*([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/;

// Header decorations that may trail the date on the same header line (time of
// day, weekday, punctuation). Stripped so the header never becomes a candidate.
const HEADER_PUNCT = /^[\s,.!?:;\-–—()]+/;
const HEADER_WEEKDAY = /^(?:mon|tue|tues|wed|wednes|thu|thur|thurs|fri|sat|satur|sun)(?:day)?\b/i;
const HEADER_TIME = /^\d{1,2}[:.]\d{2}\s*(?:[ap]\.?m\.?)?/i;
const HEADER_AMPM = /^[ap]\.?m\.?\b/i;

type Sentence = { index: number; date: string; text: string };

// Parse a natural-language date header at the start of a line. Returns the
// normalized date ("September 06, 2016") and whatever genuine content remains on
// the line after the date and its trailing time/weekday decoration are removed.
function parseLeadingDate(line: string): { date: string; rest: string } | null {
  const m = line.match(LEADING_DATE);
  if (!m) return null;
  const month = MONTH_NUMBERS[m[1].toLowerCase()];
  if (!month) return null;
  const day = parseInt(m[2], 10);
  if (day < 1 || day > 31) return null;
  const date = `${MONTH_NAMES[month - 1]} ${String(day).padStart(2, "0")}, ${m[3]}`;

  let rest = line.slice(m[0].length);
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of [HEADER_PUNCT, HEADER_WEEKDAY, HEADER_TIME, HEADER_AMPM]) {
      const mm = rest.match(re);
      if (mm && mm[0].length > 0) {
        rest = rest.slice(mm[0].length);
        changed = true;
      }
    }
  }
  return { date, rest };
}

// Normalize an externally-supplied entry date (metadata) into the engine's
// natural display format ("Month DD, YYYY", or "Month YYYY" / "YYYY" when the
// day/month is unknown). Accepts ISO (YYYY-MM-DD / YYYY-MM) and several natural
// forms (month-day-year, day-month-year, month-year, bare year). Returns null
// when no real date can be read, so the caller falls back to "unknown".
function normalizeEntryDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const fmt = (month: number, day: number | null, year: string): string | null => {
    if (month < 1 || month > 12) return null;
    const name = MONTH_NAMES[month - 1];
    if (day !== null) {
      if (day < 1 || day > 31) return null;
      return `${name} ${String(day).padStart(2, "0")}, ${year}`;
    }
    return `${name} ${year}`;
  };

  // ISO: 2025-05-24 or 2025-05
  const iso = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (iso) {
    return fmt(parseInt(iso[2], 10), iso[3] ? parseInt(iso[3], 10) : null, iso[1]);
  }

  // Natural month-day-year: "May 24, 2025", "Sep 6 2016"
  let m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/);
  if (m && MONTH_NUMBERS[m[1].toLowerCase()]) {
    return fmt(MONTH_NUMBERS[m[1].toLowerCase()], parseInt(m[2], 10), m[3]);
  }

  // Natural day-month-year: "24 August 2015"
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?\s*,?\s*(\d{4})\b/);
  if (m && MONTH_NUMBERS[m[2].toLowerCase()]) {
    return fmt(MONTH_NUMBERS[m[2].toLowerCase()], parseInt(m[1], 10), m[3]);
  }

  // Natural month-year: "April 2016", "Aug 2015"
  m = s.match(/^([A-Za-z]{3,9})\.?\s*,?\s*(\d{4})\b/);
  if (m && MONTH_NUMBERS[m[1].toLowerCase()]) {
    return fmt(MONTH_NUMBERS[m[1].toLowerCase()], null, m[2]);
  }

  // Bare year: "2026"
  m = s.match(/^(\d{4})$/);
  if (m) return m[1];

  return null;
}

// Split the raw input into dated entry blocks. Prefers explicit [YYYY-MM-DD]
// markers (the app's own format); falls back to natural-language date HEADER
// LINES so a pasted journal keeps its real per-entry dates instead of "unknown".
function parseEntryBlocks(raw: string): { date: string; text: string }[] {
  const bracket = [...raw.matchAll(DATE_MARKER)];
  if (bracket.length > 0) {
    return bracket.map((m, i) => {
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < bracket.length ? (bracket[i + 1].index ?? raw.length) : raw.length;
      return { date: m[1], text: raw.slice(start, end) };
    });
  }

  const blocks: { date: string; lines: string[] }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseLeadingDate(line);
    if (parsed) {
      const block = { date: parsed.date, lines: [] as string[] };
      if (parsed.rest.trim()) block.lines.push(parsed.rest);
      blocks.push(block);
    } else {
      const cur = blocks[blocks.length - 1];
      if (cur) cur.lines.push(line);
      else if (line.trim()) blocks.push({ date: "unknown", lines: [line] });
    }
  }
  return blocks.map((b) => ({ date: b.date, text: b.lines.join("\n") }));
}

function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    // Split on whitespace that FOLLOWS sentence-ending punctuation (. ! ? …),
    // keeping runs like "?!" or "..." attached. Decimals (3.5) are not split
    // because the period is not followed by whitespace.
    for (const part of trimmedLine.split(/(?<=[.!?…])\s+/)) {
      const s = part.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

// Sentence-sample `text` down to ~maxChars: keep whole sentences from the head
// (they set context) and the tail (the most recent feeling) verbatim, then fill
// the remaining budget from the middle at an even stride. Whole sentences only —
// via splitSentences — so a thought is never cut mid-clause; selected sentences
// are emitted in original order. Used only for entries past READ_WINDOW_ENTRY_CHARS.
function sampleSentences(text: string, maxChars: number): string {
  const sentences = splitSentences(text);
  const len = (i: number): number => sentences[i].length + 1;

  // Too few sentences to sample meaningfully — keep as many from the front as fit.
  if (sentences.length <= 4) {
    const out: string[] = [];
    let used = 0;
    for (const s of sentences) {
      if (used + s.length + 1 > maxChars && out.length > 0) break;
      out.push(s);
      used += s.length + 1;
    }
    return out.join(" ").trim();
  }

  const keep = new Set<number>();

  // Head — consecutive sentences from the opening.
  let budget = maxChars * 0.45;
  let i = 0;
  while (i < sentences.length && budget - len(i) > 0) {
    keep.add(i);
    budget -= len(i);
    i += 1;
  }
  const headEnd = i; // first index NOT kept as head

  // Tail — consecutive sentences from the close.
  budget = maxChars * 0.2;
  let j = sentences.length - 1;
  while (j >= headEnd && budget - len(j) > 0) {
    keep.add(j);
    budget -= len(j);
    j -= 1;
  }
  const tailStart = j + 1; // first index kept as tail

  // Middle — even stride across the un-kept span to fill the rest of the budget.
  const span = tailStart - headEnd;
  if (span > 0) {
    budget = maxChars * 0.35;
    let midChars = 0;
    for (let k = headEnd; k < tailStart; k += 1) midChars += len(k);
    const avg = midChars / span;
    const affordable = Math.max(1, Math.floor(budget / Math.max(1, avg)));
    const stride = Math.max(1, Math.ceil(span / affordable));
    for (let k = headEnd; k < tailStart; k += stride) keep.add(k);
  }

  return [...keep]
    .sort((a, b) => a - b)
    .map((idx) => sentences[idx])
    .join(" ")
    .trim();
}

// Bound each entry's text to the per-entry read window. Fast path: if NO block is
// oversized, return the input UNCHANGED so ordinary entries (and every existing
// fixture) hit the exact same downstream segmentation as before. Only when a block
// exceeds the cap do we reconstruct — windowing the oversized block(s) and emitting
// every block under an explicit [date] header (an unknown date resolves to the
// import/metadata fallback, exactly as segmentEntries would apply it, so the
// non-truncating reconstruction stays date-equivalent to the original). Applied on
// the EXTRACT path only; the crisis check reads the present state in full.
function windowEntries(raw: string, fallbackDate?: string | null): string {
  const blocks = parseEntryBlocks(raw);
  if (!blocks.some((b) => b.text.length > READ_WINDOW_ENTRY_CHARS)) return raw;
  return blocks
    .map((b) => {
      const date = b.date === "unknown" && fallbackDate ? fallbackDate : b.date;
      const text =
        b.text.length > READ_WINDOW_ENTRY_CHARS
          ? sampleSentences(b.text, READ_WINDOW_ENTRY_CHARS)
          : b.text.trim();
      return `[${date}]\n${text}`;
    })
    .join("\n\n")
    .trim();
}

function segmentEntries(
  raw: string,
  fallbackDate?: string | null,
): { sentences: Map<number, Sentence>; prompt: string } {
  const blocks = parseEntryBlocks(raw);

  const sentences = new Map<number, Sentence>();
  const lines: string[] = [];
  let idx = 0;
  for (const block of blocks) {
    const blockSentences = splitSentences(block.text);
    if (blockSentences.length === 0) continue;
    // When the text carries no parseable date, fall back to the entry-date
    // metadata so single-entry remembrances still anchor to a real date.
    const blockDate = block.date === "unknown" && fallbackDate ? fallbackDate : block.date;
    lines.push(`[${blockDate}]`);
    for (const text of blockSentences) {
      idx += 1;
      sentences.set(idx, { index: idx, date: blockDate, text });
      lines.push(`#${idx}: ${text}`);
    }
    lines.push("");
  }

  return { sentences, prompt: lines.join("\n").trim() };
}

// --- Pass 1 candidate reconstruction ---
// Turn the model's index-based output into the public candidate shape
// {date, fragment, source_type}. Fragments are rebuilt verbatim from the
// segmented sentences, so the output contract for /score is unchanged.

const VALID_SOURCE_TYPES = new Set(["journal", "saved_quote", "copied_text", "unknown"]);
const VALID_MODES = new Set(["thread", "memory", "distance", "value_signal", "wisdom"]);

// Clamp a sorted, same-date index list to the candidate-span rule: ONE sentence
// by default, at most TWO ADJACENT sentences. A non-adjacent or over-long set is
// a model slip; deterministically keep the first contiguous run (≤2).
function clampSpan(sortedIndices: number[]): number[] {
  const span = [sortedIndices[0]];
  if (sortedIndices.length > 1 && sortedIndices[1] === sortedIndices[0] + 1) {
    span.push(sortedIndices[1]);
  }
  return span;
}

type RawEvidence = { sentence_indices?: unknown; source_type?: unknown };
type RawCandidate = {
  mode?: unknown;
  candidate_title?: unknown;
  function?: unknown;
  description?: unknown;
  evidence?: unknown;
  why_it_matters?: unknown;
};

function reconstructCandidates(raw: unknown, sentences: Map<number, Sentence>) {
  const root = raw as { candidates?: unknown };
  const rawCandidates = Array.isArray(root?.candidates) ? (root.candidates as RawCandidate[]) : [];
  const candidates: {
    mode: string;
    candidate_title: string;
    function: string;
    description: string;
    evidence: { date: string; fragment: string; source_type: string }[];
    why_it_matters: string;
  }[] = [];

  for (const rc of rawCandidates) {
    // Drop candidates whose mode is not a valid remembrance mode — otherwise
    // /extract could emit a candidate that /score's CandidateSchema rejects (400).
    const mode = typeof rc.mode === "string" && VALID_MODES.has(rc.mode) ? rc.mode : null;
    if (!mode) continue;

    const rawEvidence = Array.isArray(rc.evidence) ? (rc.evidence as RawEvidence[]) : [];
    const evidence: { date: string; fragment: string; source_type: string }[] = [];

    for (const ev of rawEvidence) {
      const indices = Array.isArray(ev.sentence_indices)
        ? [
            ...new Set(
              (ev.sentence_indices as unknown[])
                .map((n) => (typeof n === "number" ? n : parseInt(String(n), 10)))
                .filter((n) => Number.isInteger(n) && sentences.has(n)),
            ),
          ].sort((a, b) => a - b)
        : [];
      if (indices.length === 0) continue;

      const sourceType = VALID_SOURCE_TYPES.has(String(ev.source_type))
        ? String(ev.source_type)
        : "journal";

      // Group indices by date; emit one whole-sentence fragment per date so an
      // evidence item that accidentally crosses a date boundary still yields
      // correctly-dated, whole-sentence fragments.
      const byDate = new Map<string, number[]>();
      for (const n of indices) {
        const d = sentences.get(n)!.date;
        const arr = byDate.get(d);
        if (arr) arr.push(n);
        else byDate.set(d, [n]);
      }
      for (const [date, ns] of byDate) {
        // Enforce the span rule server-side: one sentence, or two adjacent.
        const span = clampSpan(ns);
        const fragment = span.map((n) => sentences.get(n)!.text).join(" ");
        evidence.push({ date, fragment, source_type: sourceType });
      }
    }

    if (evidence.length === 0) continue; // no valid textual basis → drop candidate

    candidates.push({
      mode,
      candidate_title: typeof rc.candidate_title === "string" ? rc.candidate_title : "",
      function: typeof rc.function === "string" ? rc.function : "",
      description: typeof rc.description === "string" ? rc.description : "",
      evidence,
      why_it_matters: typeof rc.why_it_matters === "string" ? rc.why_it_matters : "",
    });
  }

  return { candidates };
}

// --- Routes ---

router.post("/still/extract", async (req, res) => {
  const parsed = ExtractInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input: entries field is required" });
    return;
  }

  // Only an EXPLICIT entry-date (in-text header or supplied metadata) belongs in
  // the cache key. The dateless import-date fallback below is deliberately NOT
  // keyed: the first extraction freezes the import date into the cached result,
  // so re-opening the same dateless paste keeps its original import date.
  const metadataDate = normalizeEntryDate(parsed.data.date);
  const key = cacheKey(
    "extract",
    normalizeForCacheKey(parsed.data.entries) + (metadataDate ? `\u0000date:${metadataDate}` : ""),
  );
  const fresh = isFreshRequested(req.query);

  // A page with no recognizable date header and no supplied date attributes to
  // the import date (today) rather than the literal string "unknown".
  const importDate = normalizeEntryDate(new Date().toISOString().slice(0, 10));
  const fallbackDate = metadataDate ?? importDate;

  try {
    if (!fresh) {
      const cached = await readCachedResult(key);
      if (cached) {
        req.log.info({ key }, "Extract cache hit — serving stored candidates, no model call");
        res.json({ ...(cached as Record<string, unknown>), fromCache: true });
        return;
      }
    }

    // Crisis safeguard: check the writer's PRESENT state (most recent entry) for
    // active, present-tense crisis BEFORE extracting. Scoped to the present so a
    // lifetime of survived pain doesn't read as a current crisis (see
    // presentStateEntries). If present, never produce a thread/memory/observation/
    // quote — return a dedicated crisis signal with empty candidates so the client
    // renders care instead of an insight, and never reaches scoring. Cached like
    // any other result so re-opens are stable.
    if (await detectCrisis(presentStateEntries(parsed.data.entries), req.log)) {
      const crisisResult = {
        candidates: [],
        crisis: { supportMessage: CRISIS_SUPPORT_MESSAGE },
      };
      req.log.info({ key }, "Crisis detected — returning support signal, skipping extraction");
      await writeCachedResult(key, crisisResult);
      res.json({ ...crisisResult, fromCache: false });
      return;
    }

    // Bound pathologically long entries before segmentation (Phase 0 COGS/latency
    // cap). No-op for ordinary entries — the crisis check above already ran on the
    // full present state, so safety is unaffected.
    const windowed = windowEntries(parsed.data.entries, fallbackDate);
    const { sentences, prompt } = segmentEntries(windowed, fallbackDate);

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_PASS1,
      temperature: 0,
      system: [
        { type: "text", text: PASS1_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected response from AI" });
      return;
    }

    // A truncated response (hit the output cap) yields invalid JSON. Surface it
    // distinctly so the cause is obvious in logs — the pool feeding extraction is
    // bounded app-side (MAX_EXTRACTION_ENTRIES), so this should not happen in
    // normal operation.
    if (message.stop_reason === "max_tokens") {
      req.log.error(
        { stop_reason: message.stop_reason },
        "Extraction hit max_tokens — input pool too large; candidate JSON truncated",
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(extractJson(block.text));
    } catch {
      req.log.error({ rawLength: block.text.length }, "Failed to parse extraction JSON");
      res.status(500).json({ error: "Failed to parse extraction response" });
      return;
    }

    // Reconstruct verbatim, whole-sentence fragments from the model's sentence
    // indices so candidate fragments are always snapped to segment boundaries.
    const result = reconstructCandidates(raw, sentences);

    await writeCachedResult(key, result);
    res.json({
      ...result,
      fromCache: false,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheCreationTokens: message.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Extract route error");
    res.status(500).json({ error: "Failed to extract candidates" });
  }
});

// Voice pass for a why-today override (ADR 0001 S2c). Re-runs PASS2 on the SINGLE
// chosen candidate so the surfaced voice/quotes/label come from the same
// calibrated scorer — no separate voice prompt to drift from PASS2. The candidate
// already cleared its gates in the full run; if the re-run declines (mode
// "nothing") or anything fails, returns null and the caller keeps the blind
// winner. Runs only when an override actually fires, so the extra call is rare.
async function surfaceOverrideCandidate(
  candidate: z.infer<typeof CandidateSchema>,
): Promise<Record<string, unknown> | null> {
  const { themes: _themes, ...rest } = candidate;
  const annotated = {
    ...rest,
    evidence_metadata: computeEvidenceMetadata(candidate.evidence),
  };
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_PASS2,
    temperature: 0,
    system: [
        { type: "text", text: PASS2_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
    messages: [{ role: "user", content: JSON.stringify({ candidates: [annotated] }) }],
  });
  const block = message.content[0];
  if (block.type !== "text") return null;
  let r: unknown;
  try {
    r = JSON.parse(extractJson(block.text));
  } catch {
    return null;
  }
  reattributeQuoteDates(r, [candidate]);
  sanitizeSecondaryThread(r);
  enforceCoherenceInvariant(r);
  const rr = r as { mode?: string };
  if (!rr.mode || rr.mode === "nothing") return null;
  return r as Record<string, unknown>;
}

router.post("/still/score", async (req, res) => {
  const parsed = ScoreInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input: candidates array required" });
    return;
  }

  // Annotate each candidate with pre-computed evidence metadata. `themes` (used
  // only by soft affinity) is stripped here so the model scoring payload and the
  // cache key stay byte-identical regardless of personalization.
  const annotated = parsed.data.candidates.map(({ themes: _themes, ...c }) => ({
    ...c,
    evidence_metadata: computeEvidenceMetadata(c.evidence),
  }));

  // Because /extract is cached, re-opening the same entry yields identical
  // candidates here, so the score key is stable and the whole pipeline serves
  // from cache (zero model calls end-to-end). Key on a canonical (sorted-key)
  // form so cache-served candidates — whose key order is changed by jsonb
  // round-tripping — still hash to the same value as the cold run.
  // Scoring is ALWAYS context-blind. A DEV-engine fixed-candidate-set control
  // proved that putting today's context in the scoring prompt inflates axis
  // scores (the resonant candidate's emotional_center rose a clean +1.0 and won
  // on the MASTER axis rather than as a tiebreak) — so the calibrated scorer must
  // never see personalization context. The why-today preference is applied AFTER
  // scoring, deterministically in code, over the model's pure scores (see
  // why-today.ts and docs/adr/0001-personalization-seam.md). The cache key is
  // therefore pure candidates — shared with the flag-off path, no churn.
  const payload = JSON.stringify({ candidates: annotated });

  // Why-today (ADR 0001) caches the POSSIBLY-OVERRIDDEN result under a separate,
  // context-bearing key so it never pollutes the flag-off cache. The context is
  // COARSENED to month + sorted themes: resonance only depends on today's month
  // (anniversary), its season (derived), and recent themes — never the exact day
  // — so month granularity keeps the surfaced result (and the noisy override
  // decision frozen into it) stable within a month instead of re-rolling daily.
  const wtActive = whyTodayEnabled() && !!parsed.data.context;
  const affActive =
    softAffinityEnabled() && !!parsed.data.context?.affinityProfile;
  const coarseContext = wtActive
    ? {
        month: parseDateParts(parsed.data.context!.today ?? "")?.month ?? null,
        themes: [
          ...new Set(
            (parsed.data.context!.recentThemes ?? [])
              .map((t) => t.toLowerCase().trim())
              .filter(Boolean),
          ),
        ].sort(),
      }
    : null;
  // When affinity is active the surfaced result also depends on the favored /
  // dismissed theme sets, so the cache key must carry them. The why-today-only
  // and flag-off keys below are left BYTE-IDENTICAL to before, so the live
  // why-today cache never churns.
  const norm = (xs: string[]) =>
    [...new Set(xs.map((t) => t.toLowerCase().trim()).filter(Boolean))].sort();
  const affKey = affActive
    ? {
        favored: norm(parsed.data.context!.affinityProfile!.favored),
        dismissed: norm(parsed.data.context!.affinityProfile!.dismissed),
      }
    : null;
  const key = cacheKey(
    "score",
    affActive
      ? canonicalize({
          candidates: annotated,
          seam: { ...(wtActive ? coarseContext : {}), affinity: affKey },
        })
      : wtActive
        ? canonicalize({ candidates: annotated, whyToday: coarseContext })
        : canonicalize({ candidates: annotated }),
  );
  const fresh = isFreshRequested(req.query);

  try {
    if (!fresh) {
      const cached = await readCachedResult(key);
      if (cached) {
        req.log.info({ key }, "Score cache hit — serving stored result, no model call");
        res.json({ ...(cached as Record<string, unknown>), fromCache: true });
        return;
      }
    }

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_PASS2,
      temperature: 0,
      system: [
        { type: "text", text: PASS2_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: payload }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected response from AI" });
      return;
    }

    // A truncated response (hit the output cap) yields invalid JSON. PASS2's
    // output is one verbose object per candidate (echoing quote text + gates +
    // axes), so a large candidate set can overrun the cap — surface it distinctly.
    if (message.stop_reason === "max_tokens") {
      req.log.error(
        { stop_reason: message.stop_reason },
        "Scoring hit max_tokens — candidate set too large; scores JSON truncated",
      );
    }

    let result: unknown;
    try {
      result = JSON.parse(extractJson(block.text));
    } catch {
      req.log.error({ rawLength: block.text.length }, "Failed to parse scoring JSON");
      res.status(500).json({ error: "Failed to parse scoring response" });
      return;
    }

    reattributeQuoteDates(result, parsed.data.candidates);
    sanitizeSecondaryThread(result);
    enforceCoherenceInvariant(result);
    const guarded = result as GuardableResult;
    if (guarded.invariant_guard_fired) {
      req.log.warn(
        { reason: guarded.invariant_guard_reason },
        "Coherence invariant guard fired — downgraded surfaced result to nothing",
      );
    }

    // Post-score personalization seam (ADR 0001). ONE combined decision over the
    // model's PURE scores: why-today resonance + soft affinity, each independently
    // flag-gated. The scorer never sees context, so axis scores are never
    // inflated; the swap only ever happens among co-equal, surfaceable,
    // non-penalized candidates, and is re-voiced by a single-candidate PASS2 pass.
    // With SOFT_AFFINITY OFF this is byte-identical to the live why-today path
    // (chooseSeamOverride delegates to chooseWhyTodayOverride and the audit/log
    // contract below is preserved). Any failure is caught and leaves the blind
    // winner untouched.
    if ((wtActive || affActive) && parsed.data.context) {
      try {
        const decision = chooseSeamOverride(
          result as Parameters<typeof chooseSeamOverride>[0],
          parsed.data.candidates,
          parsed.data.context,
          {
            whyToday: wtActive,
            profile: affActive ? parsed.data.context.affinityProfile : undefined,
          },
        );
        if (decision?.toTitle) {
          const chosen = parsed.data.candidates.find(
            (c) => (c.candidate_title ?? "") === decision.toTitle,
          );
          const voiced = chosen ? await surfaceOverrideCandidate(chosen) : null;
          if (voiced) {
            const r = result as Record<string, unknown>;
            r.mode = voiced.mode;
            r.label = voiced.label;
            r.observation = voiced.observation;
            r.quotes = voiced.quotes;
            r.why = voiced.why;
            const audit = {
              fromTitle: decision.fromTitle,
              toTitle: decision.toTitle,
              reasons: decision.reasons,
            };
            // Preserve the live why-today audit + log contract when affinity is
            // off; use a general seam audit once affinity can contribute.
            if (affActive) {
              r.winning_tiebreak_level = "seam";
              r.seam_override = audit;
            } else {
              r.winning_tiebreak_level = "why_today";
              r.why_today_override = audit;
            }
            // If a cross-mode override makes the new primary itself a cross-time
            // thread/distance, drop the blind run's secondaryThread so it can't
            // duplicate the primary (mirrors PASS2's "primary is a thread →
            // secondaryThread = null" rule).
            if (voiced.mode === "thread" || voiced.mode === "distance") {
              r.secondaryThread = null;
            }
            req.log.info(
              affActive ? { seam: decision } : { whyToday: decision },
              affActive ? "seam: applied override" : "why-today: applied override",
            );
          } else {
            req.log.info(
              affActive ? { seam: decision } : { whyToday: decision },
              affActive
                ? "seam: override declined (voice pass returned nothing); blind winner kept"
                : "why-today: override declined (voice pass returned nothing); blind winner kept",
            );
          }
        }
      } catch (err) {
        req.log.warn(
          { err },
          affActive
            ? "seam error (ignored; blind winner kept)"
            : "why-today seam error (ignored; blind winner kept)",
        );
      }
    }

    await writeCachedResult(key, result);
    res.json({
      ...(result as Record<string, unknown>),
      fromCache: false,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheCreationTokens: message.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Score route error");
    res.status(500).json({ error: "Failed to score candidates" });
  }
});

const ClassifyInputSchema = z.object({
  text: z.string().min(1),
});

// POST /still/classify — per-entry safety verdict for DATE-BASED resurfacing.
// Returns { crisis, hardFloor, version } for ONE entry's text: crisis reuses the
// canonical §3.1 check; hardFloor is the whole-entry §3 floor check. Cached in
// still_results (keyed on text + PROMPT_VERSION) so re-tagging is free and a
// PROMPT_VERSION bump recomputes. The app stores the verdict on the entry and
// never calls a model at view time. Internal route; not called by the browser.
router.post("/still/classify", async (req, res) => {
  const parsed = ClassifyInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input: text required" });
    return;
  }

  const key = cacheKey("classify", normalizeForCacheKey(parsed.data.text));
  const fresh = isFreshRequested(req.query);

  try {
    if (!fresh) {
      const cached = await readCachedResult(key);
      if (cached) {
        res.json(cached);
        return;
      }
    }

    const [crisis, hardFloor, theme] = await Promise.all([
      detectCrisis(parsed.data.text, req.log),
      detectHardFloor(parsed.data.text, req.log),
      detectTheme(parsed.data.text, req.log),
    ]);

    const result = { crisis, hardFloor, theme, version: PROMPT_VERSION };
    await writeCachedResult(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Classify route error");
    res.status(500).json({ error: "Failed to classify entry" });
  }
});

// Entry storage moved to routes/entries.ts (/entries namespace). This file is
// now purely the two-pass engine (extract + score) and its result cache.

export default router;
