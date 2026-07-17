// The free-vs-membership comparison, shared by the landing's pricing section and
// the public /pricing page so the plan details (and prices) can never drift.
// Pricing source of truth: docs/MONETIZATION-STRATEGY.md.
export function PricingCards() {
  return (
    <div className="grid md:grid-cols-2 gap-5 text-left">
      <div className="border border-border rounded-2xl bg-surface/70 p-7">
        <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-2">
          Your journal
        </p>
        <p className="font-display text-3xl text-deep-brown">Free</p>
        <p className="font-body text-soft-ink leading-relaxed mb-5">Forever.</p>
        <ul className="space-y-2 font-body text-soft-ink text-sm leading-relaxed">
          <li>Unlimited writing, keeping &amp; importing</li>
          <li>Your whole archive, private &amp; encrypted</li>
          <li>Export everything, anytime</li>
          <li>
            <span className="text-ink">4 fresh returns a month</span> (about one a
            week)
          </li>
          <li>Revisit anything that's returned, always free</li>
        </ul>
      </div>
      <div className="border border-accent-sepia/40 rounded-2xl bg-surface p-7">
        <p className="font-sans text-xs uppercase tracking-[0.18em] text-accent-sepia mb-2">
          Membership
        </p>
        <p className="font-display text-3xl text-deep-brown">
          $8.99<span className="text-lg text-soft-ink"> / mo</span>
        </p>
        <p className="font-body text-soft-ink leading-relaxed mb-5">
          or $59.99 a year, about $5/mo, 44% off.
        </p>
        <ul className="space-y-2 font-body text-soft-ink text-sm leading-relaxed">
          <li>Everything in the free journal</li>
          <li>
            <span className="text-ink">Unlimited fresh returns</span> across your
            years
          </li>
          <li>Read across all your time, whenever you like</li>
        </ul>
      </div>
    </div>
  );
}
