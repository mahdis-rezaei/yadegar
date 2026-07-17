import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetEntry,
  useUpdateEntry,
  useDeleteEntry,
  useListReflections,
  useCreateReflection,
  useDeleteReflection,
  getListEntriesQueryKey,
  getGetEntryQueryKey,
  getListReflectionsQueryKey,
  type EntryUpdateResurfacingPreference,
} from "@workspace/api-client-react";
import { AppNav } from "@/components/app-nav";
import { ShelfToggle } from "@/components/shelf-toggle";
import { CollectionPicker } from "@/components/collection-picker";
import { EntryImages } from "@/components/entry-images";
import { RichEditor } from "@/components/rich-editor";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Seed the rich editor from a legacy plain-text entry: paragraphs split on blank
// lines, single newlines become <br>. (Used only when an entry has no bodyRich.)
function plainToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const RESURFACING: {
  value: EntryUpdateResurfacingPreference;
  label: string;
}[] = [
  { value: "normal", label: "Let Yadegar return this" },
  { value: "more_often", label: "Return this more often" },
  { value: "never", label: "Never return this automatically" },
];

function longDate(d: string | null | undefined): string {
  if (!d) return "Undated";
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function EntryDetail() {
  const params = useParams();
  const id = params.entryId as string;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: entry, isLoading, error } = useGetEntry(id);
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  const { data: reflections } = useListReflections(id);
  const createReflection = useCreateReflection();
  const deleteReflection = useDeleteReflection();

  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState("");
  const [draftRich, setDraftRich] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [reflectionDraft, setReflectionDraft] = useState("");

  async function addReflection() {
    if (!reflectionDraft.trim()) return;
    await createReflection.mutateAsync({
      id,
      data: { body: reflectionDraft.trim() },
    });
    setReflectionDraft("");
    setReflecting(false);
    queryClient.invalidateQueries({ queryKey: getListReflectionsQueryKey(id) });
  }

  async function removeReflection(reflectionId: string) {
    await deleteReflection.mutateAsync({ id: reflectionId });
    queryClient.invalidateQueries({ queryKey: getListReflectionsQueryKey(id) });
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
  }

  async function patch(data: Parameters<typeof updateEntry.mutateAsync>[0]["data"]) {
    await updateEntry.mutateAsync({ id, data });
    refresh();
  }

  function startEdit() {
    if (!entry) return;
    setDraftBody(entry.body);
    setDraftRich(entry.bodyRich ?? plainToHtml(entry.body));
    setDraftDate(entry.entryDate ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    await patch({
      body: draftBody,
      bodyRich: draftRich,
      entryDate: draftDate || null,
    });
    setEditing(false);
  }

  async function doDelete() {
    await deleteEntry.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
    setLocation("/library");
  }

  // Take this page with you, a plain-text copy, entry plus any reflections.
  function exportEntry() {
    if (!entry) return;
    const lines = [longDate(entry.entryDate)];
    if (entry.title) lines.push("", entry.title);
    lines.push("", entry.body);
    for (const r of reflections ?? []) {
      lines.push("", "—", `Reflection · ${longDate(r.reflectionDate)}`, "", r.body);
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yadegar-${entry.entryDate ?? "undated"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />

      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        <Link
          href="/library"
          className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
        >
          ← Library
        </Link>

        {isLoading ? (
          <p className="font-sans text-sm text-faint-ink mt-10">Opening…</p>
        ) : error || !entry ? (
          <div className="mt-10">
            <p className="font-body text-xl text-soft-ink mb-3">
              This page could not be found.
            </p>
            <Link
              href="/library"
              className="font-sans text-sm text-accent-sepia underline underline-offset-2"
            >
              Back to your Library
            </Link>
          </div>
        ) : (
          <article className="mt-8">
            <div className="flex items-baseline justify-between gap-4 mb-8">
              <h1 className="font-display text-3xl md:text-4xl text-deep-brown">
                {longDate(entry.entryDate)}
              </h1>
              <div className="flex items-center gap-4 shrink-0">
                <CollectionPicker entryId={id} />
                <ShelfToggle entryId={id} />
                <button
                  onClick={() => patch({ favorite: !entry.favorite })}
                  className={
                    "text-2xl leading-none transition-colors " +
                    (entry.favorite
                      ? "text-accent-sepia"
                      : "text-faint-ink hover:text-soft-ink")
                  }
                  aria-label={entry.favorite ? "Unfavorite" : "Favorite"}
                  data-testid="button-favorite"
                >
                  {entry.favorite ? "★" : "☆"}
                </button>
              </div>
            </div>

            {editing ? (
              <div className="flex flex-col gap-4">
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="self-start bg-surface border border-border rounded-lg px-3 py-2 text-sm text-soft-ink font-sans focus:outline-none focus:border-accent-sepia"
                />
                <RichEditor
                  initialHTML={draftRich ?? ""}
                  ariaLabel="Edit this page"
                  onChange={(html, text) => {
                    setDraftRich(html);
                    setDraftBody(text);
                  }}
                  className="w-full min-h-[40vh] bg-surface border border-border rounded-lg p-5 text-lg text-ink font-body leading-relaxed flex flex-col"
                  data-testid="input-edit-body"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={saveEdit}
                    className="rounded-full bg-deep-brown text-background px-6 py-2 font-sans text-sm hover:bg-ink transition-colors"
                    data-testid="button-save-edit"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="font-sans text-sm text-soft-ink hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
                <EntryImages entryId={id} editable />
              </div>
            ) : (
              <>
                {entry.bodyRich ? (
                  // Server-sanitized HTML, safe to render.
                  <div
                    className="rich-content font-body text-lg md:text-xl text-ink leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: entry.bodyRich }}
                  />
                ) : (
                  <p className="font-body text-lg md:text-xl text-ink leading-relaxed whitespace-pre-wrap">
                    {entry.body}
                  </p>
                )}
                <EntryImages entryId={id} />
              </>
            )}

            {!editing && (
              <div className="mt-12">
                {(reflections ?? []).length > 0 && (
                  <div className="space-y-7 mb-8">
                    {(reflections ?? []).map((r) => (
                      <div
                        key={r.id}
                        className="border-l-2 border-accent-sepia/30 pl-5"
                      >
                        <div className="flex items-baseline justify-between gap-3 mb-1.5">
                          <span className="font-sans text-xs uppercase tracking-[0.16em] text-faint-ink">
                            Reflection · {longDate(r.reflectionDate)}
                          </span>
                          <button
                            onClick={() => removeReflection(r.id)}
                            className="font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors"
                            aria-label="Delete reflection"
                          >
                            remove
                          </button>
                        </div>
                        <p className="font-body text-lg text-soft-ink leading-relaxed whitespace-pre-wrap">
                          {r.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {reflecting ? (
                  <div className="flex flex-col gap-3">
                    <textarea
                      value={reflectionDraft}
                      onChange={(e) => setReflectionDraft(e.target.value)}
                      autoFocus
                      placeholder="Write to the person who wrote this…"
                      className="w-full min-h-[140px] bg-surface border border-border rounded-lg p-4 text-lg text-ink font-body leading-relaxed placeholder:text-faint-ink focus:outline-none focus:border-accent-sepia resize-none"
                      data-testid="input-reflection"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={addReflection}
                        disabled={!reflectionDraft.trim()}
                        className="rounded-full bg-deep-brown text-background px-6 py-2 font-sans text-sm hover:bg-ink disabled:opacity-50 transition-colors"
                        data-testid="button-add-reflection"
                      >
                        Add reflection
                      </button>
                      <button
                        onClick={() => {
                          setReflecting(false);
                          setReflectionDraft("");
                        }}
                        className="font-sans text-sm text-soft-ink hover:text-ink"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReflecting(true)}
                    className="font-sans text-sm text-accent-sepia hover:text-deep-brown border-b border-accent-sepia/40 pb-0.5 transition-colors"
                    data-testid="button-reflect"
                  >
                    Reflect on this page
                  </button>
                )}
              </div>
            )}

            {!editing && (
              <div className="mt-14 pt-8 border-t border-border/60 space-y-8">
                <div>
                  <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-3">
                    When Yadegar may return this
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {RESURFACING.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          patch({ resurfacingPreference: opt.value })
                        }
                        className={
                          "rounded-full border px-4 py-1.5 font-sans text-sm transition-colors " +
                          (entry.resurfacingPreference === opt.value
                            ? "border-accent-sepia text-ink bg-surface"
                            : "border-border text-soft-ink hover:text-ink")
                        }
                        data-testid={`button-resurface-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <button
                    onClick={startEdit}
                    className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
                    data-testid="button-edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={exportEntry}
                    className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
                    data-testid="button-export"
                  >
                    Export
                  </button>
                  {confirmDelete ? (
                    <span className="flex items-center gap-3 font-sans text-sm">
                      <span className="text-soft-ink">Delete this page?</span>
                      <button
                        onClick={doDelete}
                        className="text-red-700 hover:underline"
                        data-testid="button-delete-confirm"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-soft-ink hover:text-ink"
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
                      data-testid="button-delete"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
