# Yadegar — The Complete Feature Reference

> A functionality-by-functionality walkthrough of the *entire* product — every screen,
> every control, and the design intent behind each. Companion to
> `YADEGAR-PRODUCT-NARRATIVE.md` (the strategy/engine/economics story). Together they're
> the full picture for a presentation, podcast, or onboarding a new teammate.
>
> Grounded in `docs/FAQ.md` (the canonical plain-language feature doc) and the live app.
> Reminder: product = **Yadegar**; codename in code = **"still."**

---

## 0. The shape of the product

Yadegar is a **lifelong journaling companion**. You **write** today's page (or **import**
years of old ones), and every so often the app **brings one page back** — a thread, a
forgotten page, a distance travelled — always in your own words, and silent when nothing
honest surfaces.

**Primary navigation:** Today · Library · Look back · Explore · Returns · Settings
(plus Shop, Membership, Help & FAQ, Profile). On phones this collapses into a **hamburger
menu**, and sub-tab bars scroll sideways.

Every feature below is built to pass one test: **"Does this help someone reconnect with
their own words?"**

---

## 1. Accounts & onboarding

- **Sign in / register** — one screen that toggles between the two. Two methods:
  **email + password** (min 8 chars) or **"Continue with Google."** On mobile, **Sign in
  with Apple** is also offered (Apple requires it when Google is present).
- **Email verification** — *gentle, not a wall.* You can use Yadegar immediately;
  unverified accounts see a banner — *"Confirm your email to keep your pages safe"* — with
  a **"Resend link"** button. Verification emails are sent from the domain via Resend.
- **Password reset** — a forgot-password link emails a reset link → set a new password.
- **Onboarding — "What brings you to Yadegar?"** (appears once, non-binding). Four paths:
  - *"I already have years of journals"* → **Import**.
  - *"I journal now and then"* → **Today**.
  - *"I'm starting fresh"* → **Today** with *"Write one honest line. It doesn't need to be
    wise."*
  - *"Let me see how it feels first"* → seeds a few **sample pages** so you can try "Bring
    a page back" before trusting it with your own words.
- **Sample pages** — clearly flagged (*"These are sample pages, here to show you how
  Yadegar feels"*) with a one-tap **"Remove them."**

---

## 2. Writing a page (Today)

The home screen and first nav item.

- **The writing surface** — the date, a **rotating gentle prompt** (*"What wants to be
  written today?"*, *"What are you carrying?"*, *"Write one honest sentence."*, *"What
  keeps returning?"*), and a clean, distraction-free editor.
- **Auto-save** — no save button. A status in the corner reads **"saving…"** while you
  type (debounced), then **"saved."** Nothing is lost on navigation.
- **"Keep this page →"** — appears once you've written something: saves the page, clears
  the surface for a fresh one, and flashes **"Kept ✓."** Today keeps a quiet count of
  pages kept today so a written page never feels like it vanished — *Today is not a feed;
  pages live in the Library.*
- **Dating & backdating** — Today's pages are dated today; **editing** a page lets you
  change its date with a picker (for backdating). Imported pages keep their detected date;
  genuinely **undated** pages are allowed (grouped under "Undated").

---

## 3. Rich formatting, photos & voice

- **Formatting toolbar** (quiet, on-brand): **bold**, *italic*, **Heading** &
  **Subheading**, **bulleted** & **numbered lists**, **blockquote**, a small set of
  **muted text colors** (no loud colors), and **clear formatting**.
  - Design rule: formatting is for *your* reading. Yadegar always keeps a **clean
    plain-text shadow copy**, so the engine and your exports only ever see your words,
    never the markup.
- **Photos — "＋ Add image"** — upload, or **take a photo** with the camera on mobile;
  file picker on desktop. Multiple images, thumbnails, tap-to-enlarge, remove any.
  - Privacy: photos are **encrypted before they leave the server** and held in **private
    object storage** (no public link/CDN), fetched and decrypted only for you while
    signed in.
- **Voice dictation — 🎙** — tap, allow mic, speak; words appear live and finished
  sentences drop into the page. *"Dictation is handled by your browser's speech service;
  Yadegar doesn't record the audio."* Works in Chrome/Edge/Safari (incl. iOS); **hidden in
  Firefox** (no support). On mobile it uses the phone's native speech.

---

## 4. The Library & reading pages

The archive — *"shelves, not records."* Newest years first.

- **Cards** — each shows the date, a **source tag** if imported (*"imported," "sample,"
  "google doc"*), and a title or first lines as preview. The header shows total pages
  kept.
- **Search** — *"Search by word or date…"* — runs **client-side, in your browser**,
  because pages are **encrypted at rest** so the server can't read them. *A privacy
  feature, not a limitation.*
- **Filters** — **★ Favorites** toggle; **source** filter (*all / written here / imported
  / samples*); **year** and **month**; a **"clear"** reset.
- **Open a page → full view** with: **Favorite (☆/★)**, **Edit** (text/formatting/photos/
  date → Save), **Export** as `.txt` (page + its reflections), **Delete** (two-step
  confirm), add to a **Collection** or **Shelf**, and set its **resurfacing preference**.
- **Bulk delete** — **"Select"** → tick pages (or **"Select all"**) → **"Delete N
  pages"** (confirm step).
- **Continuity card** — a gentle, archival acknowledgement of writing over time (pages,
  span, oldest-page age, milestones). *The deliberate anti-streak — no guilt, no "you
  missed a day."*

---

## 5. Reflections — letters to your past self

- **What** — a note added *to* an existing page: a letter to the person who wrote it. The
  original is **never changed**; the reflection sits beneath it, dated, *like a margin
  note across time.*
- **How** — open a page → **"Reflect on this page"** → *"Write to the person who wrote
  this…"*. Removable later. **Included in exports.**
- Not comments, not chat bubbles — *"letters across time"* (e.g. a 2016 entry, then a 2027
  reply).

---

## 6. The memory engine — "✦ Bring a page back" & Returns

The heart of the product.

- **"✦ Bring a page back"** (on Today) — reads across your whole archive and returns
  **one** thing worth revisiting, or honestly says nothing surfaced. (How it works
  internally — the two-pass `/extract`→`/score` engine, scoring axes, gates, temperature
  0 + cache — is in the narrative doc §6.)
- **Progress messages** — a careful read shows calm, changing copy: *"Reading through
  your pages…"* → *"Still reading, looking across the years…"* → *"Your archive is large,
  so this takes a moment…"* → *"Almost there…"*. You can leave and return; it resumes.
- **The memory card (anatomy)** — a short **label**, the **date** the page was written, a
  **quote in your own words** (carries ~80% of the weight), a brief **observation** in
  Yadegar's voice, and **"Read the full page →."** The labels map to the engine's lenses:
  - **"A page from then"** — a page/self you'd set down
  - **"What kept returning"** — a thread across time
  - **"How far you've come"** — distance travelled
  - **"Something you seemed to know"** — a hard-won understanding
  - **"What mattered then"** — a quote/passage you'd saved (attributed, never claimed as
    your words)
  - **"Who you were becoming"** / **"What you carried through"**
- **Silence** — a real answer: *"Nothing honest surfaced this time. That's okay, Yadegar
  is better quiet than false."* If you've barely written: *"Write or bring in a few pages
  first…"*
- **Safety, in user terms** — never surfaces threads about **body/eating/appearance**
  (even positively); never **diagnoses/advises/coaches**; speaks only about **your
  writing**, never your life. On an active, present **crisis** in your most recent
  writing, it does **not** analyze — it returns a brief, warm, non-clinical message
  pointing to real help (988 / findahelpline.com) and stops. *Stated plainly as
  prototype-grade, not clinical.*
- **Determinism** — bring the same page back twice and it returns the **same** line (cached
  + temperature 0), so reflections don't shift arbitrarily.
- **The Returns page** — *"Pages Yadegar has brought back. They stay here for you to
  revisit."* Each has **★ favorite** and **"dismiss."** Revisiting a return is **always
  free** (cache-served). Empty state: *"Nothing has returned yet…"*

---

## 7. Look back — resurfacing on purpose

The difference from "Bring a page back": *that* asks the engine to choose; **Look back**
lets *you* browse your own past on purpose. (Browsing shows your whole archive; only the
engine's resurfacing honors the safety floors and your mutes.)

Three sub-tabs:
- **"What keeps returning"** — **"✦ Show me what keeps returning"** surfaces one recurring
  thread across your years. Also holds **"A page you'd forgotten"** (**"✦ Bring back a
  page you'd forgotten"**, with **"show another →"**).
- **"Revisit a time"** — pick a **month + year**; Yadegar reads that stretch back and
  lists those pages. Also includes **"How far you've come"** — pick a past year to compare
  with now.
- **"Your Year in Pages"** — a whole year gathered into one keepsake to read, print, or
  keep as a book.

Plus, on **Today**:
- **"On this day"** — if you wrote on this calendar date in past years, a quiet section
  shows those pages (most recent first) with a **"See each year"** ladder. Hidden if
  there's nothing. Respects your sensitivity + mutes; body-image/crisis pages never
  resurface.

---

## 8. Controlling what comes back to you

- **Per-page resurfacing** — on any page, under **"When Yadegar may return this":**
  **"Let Yadegar return this"** (default) · **"Return this more often"** · **"Never return
  this automatically."**
- **Memory sensitivity** (Settings → What returns):
  - **Open** — Yadegar may bring a page back on its own, plus "on this day" when you visit.
  - **Gentle** — no memory nudges; pages still appear quietly in-app, but it won't reach
    out.
  - **Protected** — nothing returns unbidden; pages come back only when *you* go looking.
  - *In all modes:* body-image and active-crisis pages never resurface; mutes always
    respected.
- **Muted periods** — pick a **From/To** month and **"Mute this period"** — pages from
  that stretch won't resurface (without deleting anything). Removable anytime.

---

## 9. Organizing — Collections, Shelf & Capsules

- **Collections** — themed groupings *"gathered by you, shown across the years. Nothing is
  interpreted; the pages simply sit together."* Create one with a name and a **kind**:
  **Person · Place · Theme · Thought · Pair.** Add pages from a page's view; inside a
  collection, **"✦ Find more pages that mention '{name}'"** pulls in references (one by
  one or **"Add all"**). A **Pair** collection shows a two-column **Before / After**
  layout.
- **Shelf** — a small set of pages you want close *right now*: *"Favorites are everything
  that mattered; the shelf is what's near."* Toggle **"Add to shelf"** on any page; the
  **Shelf** page lists them.
- **Capsules ("Send to Future Me")** — write a page and **seal it for a later you**:
  *"Once sealed, it can't be changed — a letter that waits."* Choose when it opens (**In 1
  year / 5 / 10 years, or a specific date**) → **"Seal it."** Sealed shows **"✉ Sealed ·
  Opens [date]"**; on the day it becomes **"A page from your past arrived"** → **"Open
  it."**
- **The three distinctions:** **Favorite (★)** = a lasting mark on a page that mattered ·
  **Shelf** = a short current "kept near" list · **Collections** = themed groupings across
  the whole archive.

---

## 10. Exploring — Timeline, Calendar, Book & Year in Pages

Full-archive *navigation* (distinct from resurfacing), under **Explore** / **Look back**.

- **Timeline** — *"Your life as you wrote it, oldest page to newest. Only your own words;
  nothing inferred."* Chronological spine grouped by year, with quick year-jumps; undated
  at the end.
- **Calendar** — *"Your pages by the turning of the year."* A 12-month grid → tap a month
  to see it **across all years**, grouped by year.
- **Book** — a printable book from **a single year** (grouped by month) or **favorites
  across all time**, with a cover (title, your name, page count) → **Print / Save as PDF**.
- **Your Year in Pages (Letters)** — a keepsake view of one year: a **"Your Year in
  Pages"** cover, an opening line about how many pages you wrote, the pages, → **Print /
  Save as PDF**, with year-stepping and **"Make a full book →."** Near New Year / your
  journaling anniversary, a dismissible banner on Today offers to open it.

> On mobile these are the **Explore** sub-tabs (Library · Shelf · Collections · Capsules)
> and the **Look back** tabs (What returns · Revisit · Year in Pages).

---

## 11. Importing past journals

The "wow" moment — bring in years of writing.

- **Paste** — drop your journal into the box. Dates like `[2018-03-29]`, `2018-03-29`, or
  `March 29, 2018` help it split into pages → **"Find pages."**
- **Upload a file** — plain text (`.txt`, `.md`) or a Word/Google Doc export (`.docx`).
- **Google Doc** — *File → Download → Microsoft Word (.docx)* → upload. *Words come
  through exactly, in any language.*
- **Why no PDF / handwriting** — a PDF stores glyphs, not reliable text (reading it back
  could alter your words — *Yadegar won't risk that*); scanned/handwritten images can't be
  read. **Paste** the text instead.
- **The review step (nothing saved until you confirm)** — after parsing, pages are shown
  in **year tabs** (+ an **Undated** tab). For each: **include/exclude** (checkbox),
  **fix the date** (picker), preview text; low-confidence dates flagged (*"no date found,
  add one"*). → **"Keep N pages"** → *"Kept N pages. They're in your Library now, private
  and yours."*

---

## 12. Notifications & nudges

- **Off by default** — *"Gentle, never guilt. No streaks, no 'you missed a day.'"* Opt-in,
  and only sent when there's something honest to send.
- **Two nudges** (Settings → Nudges), each **Off / Weekly / Monthly:**
  - **"A nudge to write"** — a small email invitation (*"What wants to be written
    today?"*).
  - **"A page brought back"** — reads across your years and emails one page worth
    returning to (or stays quiet).
- **What a nudge knows** — only your **timezone + chosen cadence** (to time them), never
  page content. *(Native push on mobile is the same idea — see narrative roadmap.)*

---

## 13. Privacy, security & your data

- **Private by account** — no public way to reach your pages; the app only returns your
  pages to you, signed in.
- **Encryption at rest** — every entry (words, formatting, date) **AES-256-GCM** before it
  touches the DB; photos encrypted in private object storage.
- **The honest AI line** — to find what's worth returning to, an AI model reads your words
  **privately, only to choose a page** — *never used to train it, never shown to anyone,
  never sold.* Stated plainly as private-with-a-server-key, **not** zero-knowledge
  (because the engine must read the text to work).
- **Export everything** (Settings → Privacy & your pages) — **Markdown** or **Plain text**
  (pages + reflections; scope **Everything** or **Favorites only**), or **JSON** (the
  complete archive). *"Leaving is easier than arriving."*
- **Delete account** — permanent, two-step confirm; removes profile, pages, reflections,
  returned memories, and photos, irreversibly.
- **Policies** — Privacy Policy + Terms linked from settings and footer. *Not a medical/
  mental-health service.*

---

## 14. Profile & settings

- **My profile** — set a **display name** (blank = use email), choose an **avatar color**
  or **upload a photo** (square-cropped); **email** shown but not editable (it's your
  sign-in identity). **"Save changes" → "Saved ✓."**
- **Settings hub** — **Account** (profile) · **Nudges** (cadence) · **What returns**
  (sensitivity + mutes) · **Your data** (export/delete) · a link to **the Yadegar
  philosophy** · **Sign out.**

---

## 15. Membership & pricing (user-facing)

- **Free, and stays free** — writing, keeping, importing, organizing, exporting, and
  **revisiting any page already brought back** cost nothing, no limits. *"We gate the AI,
  never your journal."*
- **What membership pays for** — the one thing that genuinely costs us: a **fresh return**
  (a brand-new two-pass AI read — "Bring a page back," "What keeps returning," "Revisit a
  time," "How far you've come").
- **Free allowance** — **4 fresh returns/month** (~one a week) + a small first-month bonus.
  **Re-opening a past return is always free and never counts.** Hit the limit and *nothing
  locks* — you just can't request a brand-new return until next month.
- **Pricing** — **$8/month** or **$59/year** (~**$4.92/mo, 38% off**) = **unlimited fresh
  returns.**
- **"Is unlimited really unlimited?"** — yes for any real practice; a high **fair-use
  ceiling** runs in the background purely to stop runaway automated use, far above human
  pace. Hit it and nothing's lost; returns resume next cycle.
- **Why subscription, not one-time** — a fresh return is an ongoing cost each time; a
  subscription honestly matches price to cost rather than over-charging once or degrading
  the engine later.
- **Never held hostage** — pages stay readable/editable/exportable free, regardless of
  plan. Cancel/lapse → keep **everything**, return to the free allowance.
- **Manage** (Settings → Membership) — pick monthly/annual → **"Become a member"** (Stripe;
  Yadegar never sees your card). **"Manage membership"** → Stripe portal (update card,
  switch plan, cancel). Cancel keeps access through the paid period.
- **Date-based is always free** — On This Day, Look Back browsing, Year in Pages, Timeline,
  Calendar are plain lookups (no AI read), free for everyone.

---

## 16. On your phone (mobile specifics)

- Full nav collapses into a **hamburger menu** with every section + account actions.
- Toolbars (editor formatting bar, Look back / Explore sub-tabs) **scroll sideways** to
  stay reachable.
- **"Take a photo"** and the **microphone** use the phone's **native camera and speech.**
- (Build/platform details — Expo/RN, SDK 54, App Store status — are in the narrative doc
  and `MOBILE-ROADMAP.md`.)

---

## 17. The cross-cutting design rules (what ties it all together)

These show up in *every* feature above:

1. **One thing or silence.** The engine returns exactly one result, or nothing.
2. **Always your own words.** Every observation points back to verbatim, dated text.
3. **Browse vs. resurface.** When *you* go looking, you see everything; only *unbidden*
   resurfacing honors the safety floors and mutes.
4. **No streaks, no guilt, no feed.** Continuity is archival, nudges are opt-in and gentle.
5. **The user owns everything.** Export anytime, delete anytime, payment never walls your
   words. *"Leaving is easier than arriving."*
6. **Honest by default.** About the AI reading your words, about crisis detection being
   prototype-grade, about "unlimited" having a fair-use ceiling.
7. **Quiet, literary, timeless, human.** "Kept," not "Submitted." A keepsake, not a
   dashboard.

---

*Source of truth note (from the FAQ): if anything here doesn't match the app, the app
wins — this reference is updated as features evolve.*
