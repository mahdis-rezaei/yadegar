import type { EngineResult } from "./types";

// Captured engine outputs, keyed by fixture id. Lets the harness run offline
// (STILL_MODE=recording) to demonstrate the checks and snapshot behavior. These
// are point-in-time captures, not live truth — for current quality, run live
// (STILL_MODE=http). Each recording notes when it was taken.
//
// - catchup-2016-09: post-segmentation + post-gate-reframe + post-date-fix run,
//   with the honest head-to-head trace. Over-gating FIXED ("I am living it! Or
//   maybe trying to live it!" is its own candidate and wins on emotional_center,
//   4 vs Funny Laughing God 3 — no anomaly); "6 bodies" stays gated (View A);
//   date is real; voice opener varied with no narrate-the-text. Selection is
//   GREEN; as of the redundancy guard it now trips one voice check — the
//   observation re-quotes its displayed line ('I am living it! Or maybe trying
//   to live it!') verbatim. That's a recorded BEFORE-state of the engine's
//   house style (the card shows the quote, so repeating it is redundant);
//   it goes green once the PASS-2 voicing is fixed to frame, not re-quote.
// - breathe-2015-08: PRE-voice-fix capture. Selection + hard floor are correct;
//   the observation still uses the banned "There's a line…" opener AND re-quotes
//   its displayed line, so its voice checks fail by design — it records the
//   before-state.

export const recordings: Record<string, EngineResult> = {
  "catchup-2016-09": {
    mode: "wisdom",
    candidates: [
      {
        lens: "wisdom",
        fragments: ["Time to keep the mask on!"],
        scores: { center: 3, specific: 3, discovery: 2, contra: 2, worth: 3 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "Economical and true, but 'mask on' is a familiar idiom — not uniquely hers.",
      },
      {
        lens: "memory",
        fragments: ["I I I? what?!"],
        scores: { center: 4, specific: 4, discovery: 4, contra: 2, worth: 4 },
        gates: {
          floors: true,
          perspective: false,
          evidence: true,
          displayable: false,
        },
        surfaceable: false,
        why: "Raw active distress with no door out — fails gate_perspective_not_wound and gate_displayable_quote.",
      },
      {
        lens: "wisdom",
        fragments: ["I am living it! Or maybe trying to live it!"],
        scores: { center: 4, specific: 4, discovery: 5, contra: 5, worth: 5 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "WINNER. The self-correction is the discovery — the truth escaping mid-sentence, holding bravado and exhaustion at once. Its own candidate (segmentation), and the unique center-4 among surfaceable.",
      },
      {
        lens: "wisdom",
        fragments: ["Until when I should live in another 6 bodies?"],
        scores: { center: 5, specific: 5, discovery: 5, contra: 3, worth: 5 },
        gates: {
          floors: true,
          perspective: false,
          evidence: true,
          displayable: false,
        },
        surfaceable: false,
        why: "Uniquely hers and emotionally central, but a raw active cry of pain with no turn — gated (View A) despite the top scores on the page.",
      },
      {
        lens: "thread",
        fragments: [
          "People think I am the happiest girl on this world!",
          "People think I should be the happiest person! But why am I not happy?!",
        ],
        scores: { center: 4, specific: 3, discovery: 3, contra: 4, worth: 4 },
        gates: {
          floors: true,
          perspective: false,
          evidence: true,
          displayable: false,
        },
        surfaceable: false,
        why: "The second fragment is a raw active wound; the first alone can't carry the contradiction — fails gate_displayable_quote as a pair.",
      },
      {
        lens: "memory",
        fragments: [
          "Tired.",
          "I am very tired...",
          "I am very very very tired!",
        ],
        scores: { center: 3, specific: 2, discovery: 2, contra: 1, worth: 2 },
        gates: {
          floors: true,
          perspective: false,
          evidence: true,
          displayable: false,
        },
        surfaceable: false,
        why: "All fragments are raw active distress — fails the filters.",
      },
      {
        lens: "wisdom",
        fragments: [
          "Life does not give you time to think to find a solution! It goes on!",
        ],
        scores: { center: 3, specific: 2, discovery: 3, contra: 2, worth: 3 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "True and hard-won, but available to anyone — not uniquely hers.",
      },
      {
        lens: "memory",
        fragments: [
          "Wish there was some funny laughing God in the sky so I could pray to him and ask him to do some miracle for me?!",
        ],
        scores: { center: 3, specific: 5, discovery: 4, contra: 4, worth: 4 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "RUNNER-UP. Strange, tender, only hers — but emotional_center is 3, so it loses to 'living it' on the first axis (no anomaly).",
      },
      {
        lens: "wisdom",
        fragments: [
          "Why did I need to go such a long way and still be just in the beginning of the road?",
        ],
        scores: { center: 3, specific: 3, discovery: 3, contra: 3, worth: 3 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "Precise and real, but widely shared — not distinctively hers. No longer wins by default.",
      },
      {
        lens: "memory",
        fragments: [
          "It has never been easy to be from a Third World War counties!",
        ],
        scores: { center: 2, specific: 3, discovery: 3, contra: 2, worth: 3 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "The slip is interesting but the page's weight doesn't hang on it.",
      },
      {
        lens: "wisdom",
        fragments: [
          "And I don't know how else to make her happy..",
          "But how can I make mom happy?",
        ],
        scores: { center: 3, specific: 3, discovery: 2, contra: 2, worth: 3 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "Honest and recurring, but the unanswerable question is a familiar grief, not a discovery.",
      },
      {
        lens: "memory",
        fragments: [
          "Why people are this selfish to think that bringing another human to this life is a blessing?!",
        ],
        scores: { center: 4, specific: 3, discovery: 3, contra: 2, worth: 3 },
        gates: {
          floors: true,
          perspective: false,
          evidence: true,
          displayable: false,
        },
        surfaceable: false,
        why: "Raw active distress at its sharpest — gated.",
      },
      {
        lens: "wisdom",
        fragments: ["You need to just survive!"],
        scores: { center: 3, specific: 2, discovery: 3, contra: 2, worth: 3 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "The lowered bar is honest, but too brief and generic to carry the page alone.",
      },
    ],
    result: {
      register: "wisdom",
      label: "WHAT YOU KNEW",
      observation:
        "Mid-sentence, the bravado cracks: 'I am living it! Or maybe trying to live it!' The revision is the whole truth — both halves needed to say it right.",
      quotes: [
        {
          date: "September 06, 2016",
          text: "I am living it! Or maybe trying to live it!",
        },
      ],
      wonAt: "emotional_center (Living It Or Trying 4 vs Funny Laughing God 3)",
      why: "You wrote the correction in the same breath as the claim — that instant self-revision is where the real thing slipped out.",
    },
  },

  "silence-list-2018": {
    mode: "nothing",
    candidates: [
      {
        lens: "value_signal",
        fragments: ["Motivational video : http://youtu.be/ZOy0YgUDwDg"],
        scores: { center: 1, specific: 1, discovery: 1, contra: 1, worth: 2 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "A saved URL with no surrounding context carries almost no emotional weight.",
      },
      {
        lens: "thread",
        fragments: [
          "Summer 2018",
          "Summer 2019",
          "Summer 2020",
          "Summer 2021",
          "Summer 2022",
        ],
        scores: { center: 2, specific: 2, discovery: 2, contra: 1, worth: 2 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "A list of year-labels is visually striking but carries no escaped truth — supporting material.",
      },
      {
        lens: "memory",
        fragments: ["Summer 2018 Summer 2019"],
        scores: { center: 1, specific: 1, discovery: 1, contra: 1, worth: 1 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "Two year-labels carry no standalone weight or discovery.",
      },
      {
        lens: "wisdom",
        fragments: ["Summer 2024 Summer 2025"],
        scores: { center: 1, specific: 1, discovery: 1, contra: 1, worth: 1 },
        gates: {
          floors: true,
          perspective: true,
          evidence: true,
          displayable: true,
        },
        surfaceable: true,
        why: "A fragment of a year-list with no surrounding context or escaped truth.",
      },
    ],
    result: {
      register: "nothing",
      label: null,
      observation: null,
      quotes: [],
      why: "Only a saved URL and a bare list of year-labels — nothing carries enough emotional weight or specificity to surface. Better silence than a false thread.",
    },
  },

  "breathe-2015-08": {
    mode: "wisdom",
    candidates: [
      {
        lens: "memory",
        fragments: [
          "I am going to meet them after a year and 4 months! But still I don't have job and dad should support me",
        ],
        scores: { center: 3, specific: 4, discovery: 3, contra: 4, worth: 3 },
        gates: { floors: true, perspective: true, evidence: true },
        surfaceable: true,
        why: "Holds reunion joy and financial shame at once, but context-setting more than the hinge.",
      },
      {
        lens: "wisdom",
        fragments: [
          "I know in a year or two I will be like stupid you lady- look how good your life was but you used to complain",
        ],
        scores: { center: 4, specific: 4, discovery: 4, contra: 5, worth: 5 },
        gates: { floors: true, perspective: true, evidence: true },
        surfaceable: true,
        why: "Steps entirely outside present distress to see herself from the future — present suffering and future gratitude in one sentence, in her own voice. Winner.",
      },
      {
        lens: "wisdom",
        fragments: [
          "maybe I just don't want to study so I am coming up with all these excuses to not study",
        ],
        scores: { center: 3, specific: 3, discovery: 4, contra: 3, worth: 3 },
        gates: { floors: true, perspective: true, evidence: true },
        surfaceable: true,
        why: "Sharp self-catching, real discovery — but not the emotional center.",
      },
      {
        lens: "memory",
        fragments: [
          "Relax Mahdis relax... Take a deep breath.... One -two - three",
          "Take deeper breath - don't think of anything lady- everything is under control",
        ],
        scores: { center: 4, specific: 4, discovery: 3, contra: 2, worth: 4 },
        gates: { floors: true, perspective: true, evidence: true },
        surfaceable: true,
        why: "The most tender moment — the journal as a live hand on her own shoulder. Loses the tiebreak on discovery.",
      },
      {
        lens: "wisdom",
        fragments: ["everything is under control...."],
        scores: { center: 2, specific: 2, discovery: 2, contra: 3, worth: 2 },
        gates: { floors: true, perspective: true, evidence: true },
        resolutionPenalized: true,
        surfaceable: false,
        why: "Resolution-type affirmation. Penalty fired because Future Self Already Knows has discovery >= 4 and contra >= 4. Demoted.",
      },
      {
        lens: "memory",
        fragments: ["up down down up- it's what it is right"],
        scores: { center: 2, specific: 4, discovery: 2, contra: 2, worth: 3 },
        gates: { floors: true, perspective: true, evidence: true },
        surfaceable: true,
        why: "Idiosyncratic and alive, but supporting texture.",
      },
      {
        lens: "memory",
        fragments: [
          "hahha is it because of the cigarette or am I getting my period?",
        ],
        scores: { center: 3, specific: 5, discovery: 3, contra: 2, worth: 3 },
        gates: { floors: true, perspective: true, evidence: true },
        surfaceable: true,
        why: "The most uniquely-hers line on the page, but doesn't carry the page's weight.",
      },
      {
        lens: "memory",
        fragments: [
          "I just quite cigarette from today too so probably it's more understandable",
        ],
        scores: { center: 2, specific: 3, discovery: 2, contra: 1, worth: 2 },
        gates: { floors: true, perspective: false, evidence: true },
        surfaceable: false,
        why: "Fails gate_perspective_not_wound — contextual detail, not a turning line. (Note: gate used as a relevance filter — flagged for refinement.)",
      },
      {
        lens: "wisdom",
        fragments: ["I'm not complaining or maybe I am"],
        scores: { center: 2, specific: 3, discovery: 3, contra: 4, worth: 3 },
        gates: { floors: true, perspective: true, evidence: true },
        surfaceable: true,
        why: "Holds a real contradiction, but doesn't carry the page's weight.",
      },
    ],
    result: {
      register: "wisdom",
      label: "WHAT YOU KNEW",
      observation:
        "There's a line in here I keep stopping on — where the writing steps all the way outside the moment and looks back at itself from the future: 'I know in a year or two I will be like stupid you lady- look how good your life was but you used to complain.' The same page that needed counting to breathe — 'Relax Mahdis relax... one - two - three' — already knew exactly how it would look from the other side.",
      quotes: [
        {
          date: "2015-08-24",
          text: "I know in a year or two I will be like stupid you lady- look how good your life was but you used to complain",
        },
        {
          date: "2015-08-24",
          text: "Relax Mahdis relax... Take a deep breath.... One -two - three",
        },
      ],
      wonAt: "discovery",
      why: "A single hard day that already held both the distress and the future perspective on the distress at the same time.",
    },
  },
};
