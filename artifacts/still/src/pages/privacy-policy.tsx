import { AmbientField, SiteNav } from "@/components/site-chrome";

// DRAFT legal copy in Yadegar's voice, honest and plain. Have a human/lawyer
// review before a public launch, and replace the contact address + governing
// law with real values. Last updated date is shown to readers.

const LAST_UPDATED = "June 2, 2026";
const CONTACT = "hello@yadegarjournal.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-2xl text-deep-brown mb-3">{title}</h2>
      <div className="space-y-3 font-body text-soft-ink leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AmbientField />
      <SiteNav showWhy={false} />
      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-20">
        <p className="font-sans text-xs uppercase tracking-[0.2em] text-faint-ink mb-3">
          Privacy Policy · last updated {LAST_UPDATED}
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-deep-brown mb-8">
          Your pages belong to you.
        </h1>

        <div className="mb-8 border border-border rounded-xl bg-surface/50 p-4 font-sans text-xs text-soft-ink">
          This is an early-access prototype. This policy is a working draft and
          will be finalized before a public launch.
        </div>

        <Section title="Who this is">
          <p>
            Yadegar is a personal journaling companion. This policy explains what
            we store, how we use it, and the control you have over it.
          </p>
        </Section>

        <Section title="What we store">
          <p>
            Your account details (email, and a name if you provide one) and the
            content you create or import, journal entries, reflections, and the
            memories Yadegar returns to you. Passwords are stored only as a salted
            hash; we never see your password.
          </p>
        </Section>

        <Section title="How we use it">
          <p>
            We use your content only to provide Yadegar: to store your pages, and
            to surface one worth returning to. To do that, your writing is sent
            to an AI model (Anthropic's Claude) that helps choose what to bring
            back.
          </p>
          <p>
            Your writing is <strong>never used to train AI models</strong>,
            never shown to other people, and never sold or shared for
            advertising.
          </p>
        </Section>

        <Section title="What we never do">
          <p>
            No advertising, no selling your data, no profiling for third parties,
            no social features that expose your writing. Yadegar has no feeds, no
            followers, and no public profiles.
          </p>
        </Section>

        <Section title="Where it lives & security">
          <p>
            Your data is stored in a managed database and transmitted over
            encrypted connections (HTTPS). Journal content is encrypted at rest.
            Access is restricted to what's needed to run the service.
          </p>
          <p>
            No system is perfectly secure. While Yadegar is in early access, please
            use sample entries rather than your most sensitive pages until the
            full security architecture is complete.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can export everything you've written at any time, and delete your
            account and all associated data permanently, both from Settings →
            Privacy. Deletion is immediate and irreversible.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Yadegar is not intended for anyone under 16. We don't knowingly collect
            data from children.
          </p>
        </Section>

        <Section title="A note on hard moments">
          <p>
            Yadegar is a reflective companion, not a medical, mental-health, or
            crisis service. If you are in danger or thinking about harming
            yourself, please contact a local crisis line or someone you trust.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If this policy changes, we'll update the date above and, for material
            changes, let you know in the app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about your privacy? Reach us at{" "}
            <span className="text-ink">{CONTACT}</span>.
          </p>
        </Section>
      </main>
    </div>
  );
}
