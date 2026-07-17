import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  exportData,
  useDeleteAccount,
  customFetch,
} from "@workspace/api-client-react";
import { AppNav } from "@/components/app-nav";

function download(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Privacy() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const deleteAccount = useDeleteAccount();

  const [exporting, setExporting] = useState(false);
  const [scope, setScope] = useState<"all" | "favorites">("all");
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const stamp = () => new Date().toISOString().slice(0, 10);

  async function exportJson() {
    setExporting(true);
    try {
      const data = await exportData();
      download(
        JSON.stringify(data, null, 2),
        `yadegar-archive-${stamp()}.json`,
        "application/json",
      );
    } finally {
      setExporting(false);
    }
  }

  async function exportText(format: "markdown" | "text") {
    setExporting(true);
    try {
      const q = scope === "favorites" ? "?scope=favorites" : "";
      const text = await customFetch<string>(
        `/api/privacy/export/${format}${q}`,
        { responseType: "text" },
      );
      const ext = format === "markdown" ? "md" : "txt";
      const type = format === "markdown" ? "text/markdown" : "text/plain";
      download(text, `yadegar-journals-${stamp()}.${ext}`, type);
    } finally {
      setExporting(false);
    }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await deleteAccount.mutateAsync();
      queryClient.clear();
      setLocation("/login");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[640px] mx-auto px-6 py-12 md:py-16">
        <Link
          href="/settings"
          className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
        >
          ← Settings
        </Link>

        <h1 className="font-display text-4xl md:text-5xl text-deep-brown mt-8 mb-6">
          Your pages belong to you.
        </h1>

        <div className="space-y-5 font-body text-lg text-soft-ink leading-relaxed">
          <p>
            Yadegar keeps your journals so you can write, return, and reflect across
            time. They are private to your account.
          </p>
          <p>
            To find what's worth returning to, Yadegar reads your words with an AI
            model, privately, only to choose a page to bring back. Your writing is
            never used to train it, never shown to anyone else, and never sold.
          </p>
          <p>
            You can take everything with you, or remove it entirely, whenever you
            like.
          </p>
        </div>

        {/* About your data, what's stored, where, and how it's protected. */}
        <div className="mt-8 border border-border rounded-2xl bg-surface/50 p-6">
          <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-4">
            About your data
          </p>
          <p className="font-body text-soft-ink text-sm leading-relaxed mb-5">
            Here is exactly what Yadegar stores, where, and how it's kept private:
          </p>
          <dl className="space-y-4">
            {[
              [
                "Your identity",
                "Your display name, email, and avatar (a colour or a small photo) are stored in a Postgres database. You sign in with email + password or Google.",
              ],
              [
                "Your pages",
                "Every entry, its words, formatting, and date, is encrypted at rest (AES-256-GCM) before it touches the database. The API only ever returns your pages to you, signed in; there is no public endpoint, so they're never reachable without your session.",
              ],
              [
                "Your photos",
                "Photos you add to a page are encrypted and kept in private object storage, never on a public CDN. The app fetches each one server-side with a private key and decrypts it only for you.",
              ],
              [
                "Reminders",
                "If you turn on nudges, only your timezone and cadence are stored, never the content of a page, to time them.",
              ],
            ].map(([term, desc]) => (
              <div key={term} className="grid sm:grid-cols-[8.5rem_1fr] gap-1 sm:gap-4">
                <dt className="font-sans text-sm text-ink">{term}</dt>
                <dd className="font-body text-soft-ink text-sm leading-relaxed">
                  {desc}
                </dd>
              </div>
            ))}
          </dl>
          <p className="font-body text-soft-ink text-sm leading-relaxed mt-5 pt-4 border-t border-border/60">
            Your pages are never shared with third parties or used to train
            anyone's models. Deleting your account permanently removes everything
, your profile, all pages, and any photos, immediately and
            irreversibly.
          </p>
        </div>

        <p className="mt-6 font-sans text-sm text-soft-ink">
          Read our{" "}
          <Link
            href="/privacy-policy"
            className="text-accent-sepia hover:text-deep-brown underline underline-offset-2"
          >
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link
            href="/terms"
            className="text-accent-sepia hover:text-deep-brown underline underline-offset-2"
          >
            Terms
          </Link>
          .
        </p>

        <div className="mt-12 space-y-8">
          <div>
            <p className="font-body text-ink mb-1">Export my journals</p>
            <p className="font-sans text-xs text-faint-ink mb-4">
              Your journals belong to you, leaving is easier than arriving. Take
              them in any format, anytime.
            </p>

            <div className="flex items-center gap-3 mb-4">
              <span className="font-sans text-xs text-faint-ink">Include</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as "all" | "favorites")}
                className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-soft-ink font-sans focus:outline-none focus:border-accent-sepia"
              >
                <option value="all">Everything</option>
                <option value="favorites">Favorites only</option>
              </select>
              <span className="font-sans text-xs text-faint-ink">
                (applies to Markdown &amp; text)
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => exportText("markdown")}
                disabled={exporting}
                className="rounded-full bg-deep-brown text-background px-5 py-2.5 font-sans text-sm hover:bg-ink disabled:opacity-50 transition-colors"
              >
                Markdown
              </button>
              <button
                onClick={() => exportText("text")}
                disabled={exporting}
                className="rounded-full border border-border text-soft-ink hover:text-ink hover:border-accent-sepia px-5 py-2.5 font-sans text-sm disabled:opacity-50 transition-colors"
              >
                Plain text
              </button>
              <button
                onClick={exportJson}
                disabled={exporting}
                className="rounded-full border border-border text-soft-ink hover:text-ink hover:border-accent-sepia px-5 py-2.5 font-sans text-sm disabled:opacity-50 transition-colors"
                data-testid="button-export"
              >
                JSON (complete archive)
              </button>
            </div>
            <p className="font-sans text-xs text-faint-ink mt-2">
              {exporting
                ? "Preparing your download…"
                : "Markdown & text include your pages and the reflections beneath them. JSON is the complete archive."}
            </p>
          </div>

          <div className="pt-8 border-t border-border/60">
            {confirm ? (
              <div className="space-y-3">
                <p className="font-body text-ink">
                  This permanently deletes your account and every page,
                  reflection, and returned memory. It cannot be undone.
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={doDelete}
                    disabled={deleting}
                    className="rounded-full bg-red-700 text-background px-6 py-2.5 font-sans text-sm hover:bg-red-800 disabled:opacity-50 transition-colors"
                    data-testid="button-delete-confirm"
                  >
                    {deleting ? "Deleting…" : "Yes, delete everything"}
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    className="font-sans text-sm text-soft-ink hover:text-ink"
                  >
                    Keep my account
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setConfirm(true)}
                  className="font-sans text-sm text-red-700 hover:underline"
                  data-testid="button-delete"
                >
                  Delete my account
                </button>
                <p className="font-sans text-xs text-faint-ink mt-2">
                  Removes everything, permanently.
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
