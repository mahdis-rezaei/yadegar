# Membership: pricing & comms case study

A PM-facing record of *why* Yadegar's membership is priced and communicated the way
it is — the strategy, the unit economics (with the cost analysis), the tail-risk
decision, and the comms architecture. Companion to the build docs
(`MONETIZATION-STRATEGY.md`, `MONETIZATION-BUILD-PLAN.md`, `STRIPE-SETUP.md`).

---

## TL;DR

- **Model:** freemium subscription. The journal is free forever; we meter only the
  one thing with real marginal cost — a **fresh AI return**.
- **Price:** **$8/mo** or **$59/yr** (≈ $4.92/mo, 38% off). Free tier = **4 fresh
  returns/month** (+3 first-month onboarding bonus).
- **Economics:** ~**$0.10** COGS per fresh return; at expected (~weekly) usage the
  blended gross margin is **~83–90%**.
- **The risk we closed:** "unlimited" with no backstop is an open-ended cost
  cheque. We bound it with a high **fair-use ceiling** (200/mo, env-tunable) that
  no real member meets but that caps the abusive tail.
- **Rollout:** built and metering in **shadow** (no one blocked) behind a single
  flag, `STILL_QUOTA_ENFORCED`, flipped on the day membership goes live.

---

## 1. Strategy: gate the AI, never the journal

The product's promise is a *lifelong* keepsake. Capping how much someone can
**write, keep, import, or revisit** would betray that — and those actions cost us
≈ $0 anyway (they're storage + SQL, no model call). So the free/paid line is drawn
at the **only** action with real, recurring marginal cost:

| Action | Marginal cost | Tier |
|---|---|---|
| Write / keep / edit / import / export | ~$0 | Free, unlimited |
| Browse, search, Collections, Shelf, Capsules | ~$0 (SQL) | Free, unlimited |
| Date-based return ("On this day", Look Back, Year in Pages) | ~$0 (SQL) | Free, unlimited |
| **A fresh AI return** (engine reads across your years) | **~$0.10** | **Metered** |
| Re-opening a past return | ~$0.002 (cache) | Free, always |

**Billable unit = a fresh AI return** (a cache-miss `/memories/run`). This is the
crux of the whole model: *cost ≈ value ≈ the thing we charge for.* We never charge
for storage or for nothing.

---

## 2. Pricing: the three jobs of a price

A price has to do three things at once. $8/$59 is chosen against all three:

1. **Cover COGS with margin.** At ~$0.10/return and ~weekly use, margin is ~85–90%
   (§3). COGS is *not* the binding constraint — value capture and conversion are.
2. **Capture value.** This is a companion to a decades-long practice, not a utility.
   $8/mo is a low, honest number for that — deliberately *below* AI-journaling peers
   (Rosebud, Mindsera ~$9–13) and competitive with plain journaling apps on the
   annual plan (Day One ~$35/yr, Stoic ~$40/yr) while offering far more.
3. **Drive the funnel.** A clean $8 psychological price + an aggressive annual
   discount (38%) optimizes for **acquisition and retention** over per-seat
   extraction — the right call for a young product whose moat is the accumulating
   archive. We can raise later; we can't un-charge early adopters.

**Why annual is steered (not forced):** annual front-loads cash, cuts churn
(one decision/year, not twelve), and improves LTV. So annual is the *default* and
the savings are shown ("save 38%"), but the nudge is a fact, not a pressure tactic —
consistent with a brand whose whole ethos is "offer, never push."

**Why subscription, not one-time:** a fresh return costs us *every time*. A
one-time price would either over-charge up front or force us to degrade the engine
later to protect margin. A subscription is the honest match of price to ongoing cost.

---

## 3. Unit economics (the cost analysis)

**COGS per fresh return** (two-pass engine, Sonnet, post-Phase-0 prompt caching):
- Warm (cache hit): **~$0.085**
- Cold / large archive: **~$0.11–0.15**
- Planning figure: **~$0.10**
- Re-opening a past return: **~$0.002** (free to user, ~free to us)

**Net revenue** (after Stripe 2.9% + $0.30):
| Plan | Gross | Net | Net/mo |
|---|---|---|---|
| Monthly | $8.00 | ~$7.47 | ~$7.47 |
| Annual | $59.00 | ~$57.00 | ~$4.75 |

**Break-even usage** (returns/mo before a member is unprofitable):
- Monthly: ~**75/mo** · Annual: ~**47/mo**

Both are ~5–15× a realistic cadence, so the median member is deeply profitable.

**Portfolio view — model a 1,000-member book:**
| Cohort | Share | Returns/mo | COGS/mo |
|---|---|---|---|
| Light | 70% | 5 | $0.50 |
| Medium | 25% | 15 | $1.50 |
| Heavy | 5% | 60 | $6.00 |

Blended ≈ **10 returns/member/mo → ~$1.03 COGS** vs ~$6 blended net revenue =
**~83% gross margin.** The product design itself (no feed, no streak, "one thing
worth returning to") suppresses compulsive use, which protects this distribution.

---

## 4. The tail risk, and the fair-use ceiling

The honest weakness of any "unlimited" plan: a small cohort can cost far more than
they pay. With nothing but the 30/hour rate limiter, a determined user could drive
hundreds of returns/day → **tens of dollars/day of COGS on $8/mo** — an open-ended
cheque.

**Decision:** price "unlimited" on the *average* (like gyms, data plans, buffets)
and clip the *tail* — don't price for the worst case.

- **Mechanism:** a high monthly **fair-use ceiling** (`MEMBER_MONTHLY_CAP`, default
  **200/mo** ≈ 6–7/day sustained, env-tunable with no deploy). Far above any human
  pace, so a real member never meets it; it only bounds runaway/automated use.
- **Effect:** worst-case member COGS goes from *unbounded* to ~cap × $0.10 ≈
  $20/mo — and approaches zero in practice because ~no one reaches it.
- **UX:** members display as **unlimited** (the ceiling is internal). If a member
  ever does hit it, the message is gentle and apologetic, nothing is lost, returns
  resume next cycle, and we invite a reply — a paying customer is never walled
  harshly. (See `quota.ts` / the `quotaGate` 402 copy.)
- **Honesty:** marketing says "unlimited… whenever you like"; the FAQ explains the
  fair-use ceiling plainly ("Is 'unlimited' really unlimited?"). Aspirational but
  true, with the fine print where fine print belongs.

This is the move an interviewer is probing for: *name the tail risk, bound it
cheaply, keep the promise true, and instrument it.*

---

## 5. Comms architecture: one story, every surface

The same narrative — **"the journal is free and yours; membership deepens the AI"**
— is told consistently wherever money appears, so there's no whiplash between
marketing and product:

| Surface | Role | Key line |
|---|---|---|
| Landing `/login` | Acquisition | "Free to keep. Yours to deepen." + free/member cards + "we gate the AI, never your journal." |
| Plan page `/settings/plan` | Conversion | Annual-default toggle, "$4.92/mo · save 38%", usage transparency |
| Upgrade dialog (in-app) | Conversion at the moment of limit | Gentle, never walls the journal; "revisiting what's returned is always free" |
| FAQ / Help | Trust | What's free vs paid, fair-use, cancel-keeps-everything |
| Welcome email | Retention / delight | Personal thank-you from the maker on joining |

Two deliberate UX choices worth calling out:
- **Usage lives in Settings, not in the reading flow.** A counter next to "Bring a
  page back" would cheapen the keepsake moment; the strategy doc explicitly warns a
  "2 of 3 left" feel betrays the promise. So the count appears only where someone
  goes to *check their plan*.
- **No payment is ever a wall on words.** Cancel/lapse → you keep every page,
  reflection, and saved return; you simply return to the free monthly allowance.
  *"Leaving is easier than arriving."*

---

## 6. Rollout: shadow → enforce

Enforcement ships **off**. The system meters every return and exposes usage, but
**blocks no one** until `STILL_QUOTA_ENFORCED=1`. This de-risks the launch:

1. **Shadow (now):** watch real demand against the cap in logs; confirm metering and
   the COGS/member metric before any wall exists. Zero user-visible change.
2. **Stripe live:** activate Stripe, swap to live keys (`STRIPE_SETUP.md`).
3. **Flip the flag:** the free limit starts blocking and the upgrade dialog appears.
   Fully reversible by unsetting the flag.

The billing webhook is the **source of truth** for `plan`; checkout's success
redirect is only a UX hint.

---

## 7. Metrics to watch (post-launch)

- **Free→member conversion rate** (overall, and by trigger surface).
- **COGS per member / per fresh return** — the margin guardrail; alert if the
  fair-use tail thickens.
- **Fresh returns per member per month** — the usage distribution behind §3; if it
  rises, revisit the ceiling and pricing.
- **Annual vs monthly mix** — annual share is a cash-flow + retention signal.
- **Churn / reactivation**, and **time-to-first-return** for new members.

---

## 8. Future revenue levers (in rough priority)

1. **Conversion & retention first** — the biggest lever at ~85% margin isn't price,
   it's funnel: onboarding-to-first-return, the upgrade moment, annual mix.
2. **A "Yadegar Forever" lifetime / patron tier** — very on-brand (a keepsake you
   *own*), captures superfans, and front-loads cash. The PRD already floats it.
3. **Drive COGS down** — e.g. tier the *extract* pass to a cheaper model while
   keeping *score* (the calibrated selection) on Sonnet; more aggressive caching.
   Widens margin or funds a lower price point.
4. **Price tests** — $8 is deliberately under market; there's likely room to test
   $9–10 once value is proven, and a higher annual ($69) if churn stays low.

---

## Appendix — pricing constants (single source of truth)

| Constant | Value | Where |
|---|---|---|
| Free monthly returns | 4 | `quota.ts` `FREE_MONTHLY_RETURNS` |
| First-month bonus | 3 | `quota.ts` `ONBOARDING_BONUS` |
| Member fair-use ceiling | 200/mo (env `MEMBER_MONTHLY_CAP`) | `quota.ts` |
| Monthly price | $8 | Stripe `STRIPE_PRICE_MONTHLY` |
| Annual price | $59 (≈$4.92/mo, 38% off) | Stripe `STRIPE_PRICE_ANNUAL` |
| Enforcement switch | `STILL_QUOTA_ENFORCED=1` | env |

If these change, update `MONETIZATION-STRATEGY.md`, the FAQ, and the landing/plan
copy together — the consistency across surfaces is the point.
