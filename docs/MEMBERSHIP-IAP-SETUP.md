# Yadegar — iOS Membership (In-App Purchase) Setup

> The mobile app can't sell membership via Stripe — **Apple requires In-App
> Purchase** for digital subscriptions, and linking to web checkout is a
> rejection (guideline 3.1.1). We use **RevenueCat** over StoreKit so it unifies
> with the existing web Stripe billing and reports entitlement changes to our
> backend.
>
> Backend is already scaffolded: `POST /api/billing/revenuecat` sets `users.plan`
> from RevenueCat events (mirrors the Stripe webhook). It's **inert until
> `REVENUECAT_WEBHOOK_AUTH` is set**. The **app paywall ships in a build AFTER
> 1.0.1**, once the items below exist (it needs the real product/entitlement IDs
> and the SDK key, and adds a native module).

## Pricing (from the strategy)
- Monthly: **$8.00** · Annual: **$59.00** (annual-first ≈ $4.92/mo).

---

## 1) App Store Connect — you must do this first
1. **Agreements, Tax, and Banking**: sign the **Paid Applications Agreement** and
   complete **banking + tax** info. *No IAP works until this is active.*
2. **Subscriptions** (under the Yadegar app → Monetization → Subscriptions):
   - Create a **Subscription Group** (e.g. "Yadegar Membership").
   - Add two **auto-renewable subscriptions** in that group. Product IDs
     (permanent — these are the ones created in App Store Connect):
     - `com.yadegar.app.member.monthly` — duration 1 month, **$8.99**
     - `com.yadegar.app.member.yearly` — duration **1 year (upfront)**, **$59.99**
       (`.annual` was burned by an earlier attempt — Apple reserves product IDs
       permanently, so we use `.yearly`. Do NOT offer "Monthly with 12-Month
       Commitment" — 1 Year Upfront only.)
   - For each: add a localized display name + description, and a **review
     screenshot** + review notes (Apple requires these to approve the IAP).
3. Generate an **App-Specific Shared Secret** (App → ... or under In-App
   Purchase) — RevenueCat needs it to validate receipts. (Or use an App Store
   Connect API key; RevenueCat supports both.)

## 2) RevenueCat
1. Create an account → new **Project** → add an **App** with bundle id
   `com.yadegar.app`; paste the App Store **Shared Secret** (or API key).
2. **Entitlement**: create one called **`member`**.
3. **Products**: import/add the two App Store product IDs above; attach both to
   the `member` entitlement.
4. **Offering**: create the default offering with a **monthly** and an **annual**
   package pointing at those products.
5. Copy the **public SDK key** for Apple (starts with `appl_…`).
6. **Webhook** (Integrations → Webhooks):
   - URL: `https://yadegarjournal.com/api/billing/revenuecat`
   - **Authorization header**: set a long random secret value.

## 3) Replit env
- Set **`REVENUECAT_WEBHOOK_AUTH`** = the exact Authorization value from step 2.6.
  (This activates the backend webhook.)
- Later, when you're ready to actually enforce the free-tier limit, set
  **`STILL_QUOTA_ENFORCED=1`** (today the quota gate runs in shadow mode).

## 4) Hand back to me
Once the above exist, send me:
- The RevenueCat **public SDK key** (`appl_…`).
- The **entitlement** id (`member`) and **offering** id (default), and the two
  **product IDs**.

Then I'll build the app side: add `react-native-purchases`, initialize +
`logIn(userId)`, a native paywall (monthly/annual from the offering), purchase +
**restore purchases**, and flip `membership.tsx` from "coming soon" to the live
subscribe CTA with member/free states. That ships in the next build after 1.0.1.

## Notes
- The app sets RevenueCat's `app_user_id` to our `users.id`, so webhook events map
  straight to the user; web (Stripe) and app (Apple) both write the same
  `users.plan`. Cross-source reconciliation (someone paying on *both*) is a noted
  follow-up in `billing.ts`.
- Apple takes 15–30% of IAP revenue (Small Business Program = 15% under $1M/yr —
  worth enrolling). This is the cost of being allowed to sell in the app at all.
