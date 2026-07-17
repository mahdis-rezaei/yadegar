# Yadegar Shop: a headless commerce case study

A PM-facing record of the storefront — why it exists, the product strategy, the
headless architecture and the decisions behind it, the funnel and metrics, and the
risks. Companion to `SHOPIFY-SETUP.md` (the runbook).

## TL;DR
- **What:** a headless storefront on **Shopify's Storefront API**, native inside
  yadegarjournal.com (`/shop`), selling Yadegar-branded physical goods.
- **Why:** a third revenue line (alongside membership) that's *on-brand by
  construction* — Yadegar means "the thing that remains," and a physical journal is
  the most literal keepsake. It closes the loop: **write by hand → bring pages into
  the app**.
- **Architecture:** Storefront API (GraphQL) proxied through our Node layer → Cart
  API → **Shopify-hosted checkout**. Token stays server-side; the SPA only calls
  `/api/shop/*`. Dormant (503 / "coming soon") until env is wired.

## 1. Strategy — why a shop, and why this one

**Three revenue lines, one brand:**
| Line | Unit | Margin profile |
|---|---|---|
| Membership | fresh AI returns | ~85–90% (software) |
| Shop (this) | physical goods | 30–60% (POD → private label) |
| (Affiliate, optional) | recommendations | commission |

The shop isn't a bolt-on store — it's the **physical anchor of the brand**. The
hero product (the Yadegar Journal) *is* the product the app is named after. That
gives a defensible thesis most journaling apps can't claim: the physical and
digital reinforce each other (brand recall, LTV, a gift-able object), and the app's
**import** feature is the bridge between them.

**Why lead with one hero + a small "Desk" collection** (journal → pen → bookmark)
rather than a broad catalog: a sharp thesis converts and demos better than breadth,
while a 2–3 SKU collection still lets us show **merchandising, cross-sell, and AOV**
thinking. Start narrow, expand on signal.

## 2. Architecture — and the decisions a reviewer will probe

**Headless (Storefront API), not a Liquid Online Store theme.** We already have a
React/Vite app with its own design system and brand; a separate themed storefront
would fracture the experience and the brand. Headless keeps the shop *inside*
Yadegar's look, navigation, and account. Trade-off: we own more of the front end
(no theme/templates for free) — acceptable because the catalog is tiny and the
brand consistency is the whole point.

**Proxy through our Node layer vs. calling Shopify from the browser.** Storefront
API tokens are *public-scoped* (Hydrogen calls them client-side), so browser-direct
is legitimate. We chose a **server proxy** (`routes/shop.ts`) anyway because: it
keeps the token out of the client bundle, gives one place for error handling and
(later) response caching, reshapes GraphQL into lean UI payloads, and matches our
existing `/api` architecture. Trade-off: one network hop more; worth it here.

**Shopify-hosted checkout, not a custom one.** The cart is built with the Cart API,
then we hand off to `cart.checkoutUrl`. Checkout is where PCI, fraud, tax, shipping,
discounts, and wallets (Shop Pay/Apple Pay) live — rebuilding that is enormous risk
for zero differentiation. Own the *browsing/merchandising*; let Shopify own
*checkout*. (This is also exactly how Shopify recommends headless should work.)

**Storefront API, not Admin API.** The Admin API is for back-office writes
(inventory, orders) and needs a secret key; the Storefront API is the
customer-facing read/cart surface. Using the right API per job is the point.

**Cart persistence:** cart id in `localStorage`, rehydrated on load (and dropped if
Shopify says it's gone). Stateless server, durable cart.

## 3. The funnel
Discovery (**Shop** in the nav, landing, the app) → **PLP** ("The desk") → **PDP**
(gallery, variants, the curation note) → **cart drawer** → **Shopify checkout**.
Each step is instrumentable; the drop-off between PDP→cart and cart→checkout is
where merchandising and trust copy earn their keep.

## 4. Merchandising & pricing (physical goods)
- **Collection** ("The Desk") frames the set as a curated whole, not loose SKUs.
- **Cross-sell** (pen/bookmark on the journal PDP) and a **bundle** ("the desk set")
  lift **AOV** — the main lever for physical margin once shipping is fixed-cost-ish.
- **Margin reality:** print-on-demand (Gelato/Lulu) gets us to market with zero
  inventory at ~30–40% margin; moving to **private-label** at volume pushes 50–60%.
  Shipping and returns are the silent margin killers — price with them in mind, and
  consider free-shipping thresholds to nudge AOV.
- **Bundle with membership** later (journal + a year of membership) — a unique
  cross-line offer no pure-commerce or pure-SaaS competitor can match.

## 5. Metrics to watch
Conversion rate (visit→order), **AOV**, attach/cross-sell rate, cart-abandonment,
PDP→cart and cart→checkout drop-off, repeat-purchase rate, and **journal→app
activation** (do buyers import pages? that's the omnichannel thesis paying off).

## 6. Risks & mitigations
- **IP / "rebranding."** You can't relabel someone's retail product. Mitigation:
  make *our own* via POD/private-label; recommend others only as affiliate.
- **Fulfillment/quality.** POD removes inventory risk but cedes some control; sample
  before launch; move to vetted private-label as volume justifies.
- **Scope creep on the storefront.** Hosted checkout caps the build; resist
  rebuilding what Shopify gives free.

## 7. Roadmap
Bundles (desk set; journal + membership), free-shipping threshold, gift options,
a refill-journal **subscription** (Shopify Subscriptions), reviews, and richer
merchandising (collections per season) once there's traffic to justify it.

## Interview one-liner
> "Yadegar's shop is a headless Shopify storefront living natively in our app: we
> own browsing and merchandising via the Storefront + Cart APIs and hand checkout
> to Shopify, so we get brand consistency and speed without rebuilding payments.
> The hero product is the journal the app is named after — physical and digital
> reinforcing each other, with import as the bridge — and it's a third revenue line
> beside membership. I priced for POD margins to launch with zero inventory, and the
> growth levers are AOV (bundles/cross-sell) and journal→app activation."
