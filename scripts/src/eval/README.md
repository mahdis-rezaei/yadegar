# Still eval harness

Answers the two questions from testing, per entry, on every run:

1. **Did it choose the right thing?** (selection)
2. **Did it say too much / wrong?** (voice)

Selection is primary — prettier prose can't fix a wrong pick — so the two are
scored separately.

## Run

```bash
# offline: replay captured engine outputs (default). Reproduces known results,
# e.g. the Sep 6 2016 run where the target line was never extracted.
pnpm --filter @workspace/scripts run eval

# live: call the running engine
STILL_MODE=http STILL_API_URL=http://localhost:5000 pnpm --filter @workspace/scripts run eval
```

Exit code is non-zero if any scored case fails — usable in CI.

## What each case asserts

- **surface cases** (`expect: "surface"`): the target line is (a) extracted as a
  candidate, (b) the winner; and no anti-target wins.
- **silence cases** (`expect: "nothing"`): flat/logistical/thin input returns
  `nothing`. Guards against silence erosion as the scoring axes reward finding a
  center.
- **wound case**: raw present-distress that clears the hard floors but offers no
  perspective must still return `nothing` (the perspective gate).
- **hard floor** (`hardFloor` lines): §3 body/appearance content must be ABSENT
  from every candidate AND the result — not gated-but-present, gone. The Aug 24
  case asserts the "fat" line never surfaces.
- **voice** (any surfaced observation): no banned/stock opener, 1–3 sentences,
  shorter than its quotes, no literary/analysis vocab, no interior claims.
- **coherence**: the observation may only quote/point at lines that are in the
  displayed `quotes` (catches the voice ↔ quote-safety-filter conflict — an
  observation referencing a line the filter withheld).
- **cross-result**: no two surfaced observations open the same way (the model
  can't self-enforce this in a stateless per-entry call, so the harness does).

## Files

| file | role |
|---|---|
| `fixtures.ts` | the gold set: entries + target/anti-target lines + silence/wound cases |
| `recordings.ts` | captured engine outputs for offline runs |
| `adapter.ts` | gets a result per fixture (recording or HTTP). **`normalizeResponse` is the only engine-specific code** |
| `checks.ts` | selection + voice + diagnostic checks |
| `run.ts` | runner + scorecard |

## Wiring to the live engine

Set `STILL_MODE=http` and edit `normalizeResponse` in `adapter.ts` to map the
engine's debug JSON into the normalized `EngineResult`. Nothing else changes.

## Adding cases

Append to `fixtures.ts`. Keep held-out entries (ones the prompts were *not*
tuned against) separate in spirit from the tuning cases — passing the tuning
cases is necessary, not sufficient.
