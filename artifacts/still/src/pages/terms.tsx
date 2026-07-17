import { AmbientField, SiteNav } from "@/components/site-chrome";

// DRAFT legal copy, have a human/lawyer review before public launch and set a
// real contact address and governing law.

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

export default function Terms() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AmbientField />
      <SiteNav showWhy={false} />
      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-20">
        <p className="font-sans text-xs uppercase tracking-[0.2em] text-faint-ink mb-3">
          Terms of Service · last updated {LAST_UPDATED}
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-deep-brown mb-8">
          The agreement, in plain words.
        </h1>

        <div className="mb-8 border border-border rounded-xl bg-surface/50 p-4 font-sans text-xs text-soft-ink">
          This is an early-access prototype. These terms are a working draft and
          will be finalized before a public launch.
        </div>

        <Section title="Using Yadegar">
          <p>
            By creating an account you agree to these terms. If you don't agree,
            please don't use Yadegar.
          </p>
        </Section>

        <Section title="What Yadegar is, and isn't">
          <p>
            Yadegar is a reflective journaling companion. It is{" "}
            <strong>not</strong> a medical, mental-health, therapy, or crisis
            service, and nothing it surfaces is professional advice.
          </p>
        </Section>

        <Section title="Early access">
          <p>
            Yadegar is provided "as is," without warranties, while in active
            development. Features may change, and while we work hard to protect
            your writing, please keep your own copies of anything irreplaceable.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            Keep your login secure; you're responsible for activity under your
            account. Tell us promptly if you suspect unauthorized access.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            Use Yadegar for your own journaling. Don't attempt to break, abuse, or
            overload the service, or use it to harm others.
          </p>
        </Section>

        <Section title="Your words are yours">
          <p>
            You own everything you write. You grant Yadegar only the limited
            permission needed to store and process your content to provide the
            service (including the AI processing described in our Privacy Policy).
            We claim no ownership of your writing.
          </p>
        </Section>

        <Section title="Ending things">
          <p>
            You can delete your account and all your data at any time from
            Settings → Privacy. We may suspend accounts that abuse the service.
          </p>
        </Section>

        <Section title="Liability">
          <p>
            To the extent allowed by law, Yadegar is not liable for indirect or
            incidental damages arising from use of an early-access product.
          </p>
        </Section>

        <Section title="Changes & contact">
          <p>
            We'll update the date above when these terms change. Questions?
            Reach us at <span className="text-ink">{CONTACT}</span>.
          </p>
        </Section>
      </main>
    </div>
  );
}
