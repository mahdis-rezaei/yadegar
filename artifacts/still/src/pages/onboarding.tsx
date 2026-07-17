import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSeedSampleEntries,
  getListEntriesQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { AmbientField } from "@/components/site-chrome";

const OPTIONS: {
  key: string;
  label: string;
  note: string;
  to: string;
  seed?: boolean;
}[] = [
  {
    key: "have",
    label: "I already have years of journals",
    note: "Bring them in, paste or upload, and Yadegar will read across them.",
    to: "/import",
  },
  {
    key: "occasional",
    label: "I journal now and then",
    note: "Start with today's page; your archive grows from here.",
    to: "/today",
  },
  {
    key: "new",
    label: "I'm starting fresh",
    note: "Write one honest line. It doesn't need to be wise.",
    to: "/today",
  },
  {
    key: "explore",
    label: "Let me see how it feels first",
    note: "A few sample pages to explore, press “Bring a page back” to watch Yadegar return one. Remove them anytime.",
    to: "/today",
    seed: true,
  },
];

export default function Onboarding() {
  const { user, completeOnboarding } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const seedSamples = useSeedSampleEntries();
  const [busy, setBusy] = useState<string | null>(null);

  async function choose(to: string, key: string, seed?: boolean) {
    setBusy(key);
    try {
      await completeOnboarding();
      if (seed) {
        await seedSamples.mutateAsync();
        queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
      }
      setLocation(to);
    } catch {
      setBusy(null);
    }
  }

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AmbientField />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-[560px] text-center"
        >
          <h1 className="font-display text-4xl md:text-5xl text-deep-brown mb-4">
            {firstName ? `Welcome, ${firstName}.` : "Welcome."}
          </h1>
          <p className="font-body text-lg text-soft-ink mb-10">
            What brings you to Yadegar?
          </p>

          <div className="flex flex-col gap-3 text-left">
            {OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => choose(o.to, o.key, o.seed)}
                disabled={busy !== null}
                className="group rounded-2xl border border-border bg-surface/70 hover:border-accent-sepia transition-colors p-5 disabled:opacity-60"
                data-testid={`onboarding-${o.key}`}
              >
                <p className="font-body text-lg text-ink">
                  {busy === o.key ? "One moment…" : o.label}
                </p>
                <p className="font-body text-sm text-soft-ink mt-1">{o.note}</p>
              </button>
            ))}
          </div>

          <p className="font-sans text-xs text-faint-ink mt-8">
            You can always do any of these later.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
