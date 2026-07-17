import { Link, useLocation } from "wouter";
import { useStill } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";

function formatSavedDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "earlier today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

const MODE_RECALL: Record<string, string> = {
  thread: "something that kept returning",
  memory: "a page from your past",
  distance: "how far you've come",
  value_signal: "what mattered then",
  wisdom: "something you seemed to know",
};

function truncateLabel(label: string, maxChars = 42): string {
  if (label.length <= maxChars) return label;
  return label.slice(0, maxChars).trimEnd() + "…";
}

function buildRecallLine(
  mode: string | undefined,
  label: string | null | undefined,
  date: Date
): string {
  const dateStr = formatSavedDate(date);
  if (mode === "nothing") {
    return `You sat with your writing ${dateStr}. Nothing surfaced.`;
  }
  const base = MODE_RECALL[mode ?? ""] ?? "something";
  if (mode === "thread" && label) {
    return `Yadegar found ${base}, "${truncateLabel(label)}", ${dateStr}.`;
  }
  return `Yadegar found ${base}, ${dateStr}.`;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { scoreResult, savedAt, history, reset } = useStill();
  const { user, logout } = useAuth();

  const hasSaved = Boolean(scoreResult && savedAt);
  const historyCount = history.length;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center max-w-[680px] mx-auto">
      <h1 className="font-display text-5xl md:text-7xl text-deep-brown mb-6">
        Yadegar
      </h1>
      <p className="text-xl md:text-2xl text-ink mb-6">
        A companion for your past selves.
      </p>
      <p className="text-lg text-soft-ink leading-relaxed mb-12 max-w-md mx-auto">
        Paste old journal entries. Yadegar finds one thing worth returning to today, a forgotten page, something that kept returning, how far you've come, and stays quiet when nothing honest surfaces.
      </p>

      {hasSaved ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-4 w-full max-w-sm"
        >
          <div className="flex flex-col items-center gap-3 px-6 py-5 border border-border rounded-sm bg-surface/60 w-full">
            <p className="text-sm font-sans text-soft-ink">
              {buildRecallLine(scoreResult?.mode, scoreResult?.label, savedAt!)}
            </p>
            <button
              onClick={() => setLocation("/result")}
              className="text-accent-sepia hover:text-deep-brown font-body text-base border-b border-accent-sepia/40 pb-0.5 transition-colors"
            >
              Read it again
            </button>
          </div>

          {historyCount > 1 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-xs font-sans text-faint-ink"
            >
              You have {historyCount} thread{historyCount !== 1 ? "s" : ""}.{" "}
              <button
                onClick={() => setLocation("/history")}
                className="text-soft-ink hover:text-ink border-b border-soft-ink/30 pb-0.5 transition-colors"
              >
                View history
              </button>
            </motion.p>
          )}

          <div className="flex items-center gap-4 w-full">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-sans text-faint-ink">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => {
                reset();
                setLocation("/paste");
              }}
              className="bg-ink hover:bg-deep-brown text-surface px-8 py-3 rounded-sm font-body text-lg transition-colors"
            >
              Read across time
            </button>
            <span className="text-xs font-sans text-faint-ink">
              Your history will be kept
            </span>
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/paste"
            className="bg-ink hover:bg-deep-brown text-surface px-8 py-3 rounded-sm font-body text-lg transition-colors"
          >
            Read across time
          </Link>
          <span className="text-sm font-sans text-faint-ink">
            A quick read, your writing is read once and not kept.
          </span>
          <button
            onClick={() => setLocation("/entries")}
            className="mt-2 text-soft-ink hover:text-ink font-sans text-sm border-b border-soft-ink/30 pb-0.5 transition-colors"
          >
            Or keep an archive that stays →
          </button>
        </div>
      )}

      <footer className="mt-16 flex items-center gap-3 text-xs font-sans text-faint-ink">
        <span data-testid="text-account">
          Signed in as {user?.name || user?.email}
        </span>
        <span aria-hidden>·</span>
        <button
          onClick={async () => {
            await logout();
            setLocation("/login");
          }}
          className="text-soft-ink hover:text-ink border-b border-soft-ink/30 pb-0.5 transition-colors"
          data-testid="button-signout"
        >
          Sign out
        </button>
      </footer>
    </div>
  );
}
