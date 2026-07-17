import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetNotifications,
  useUpdateNotifications,
  getGetNotificationsQueryKey,
  type NotificationUpdate,
} from "@workspace/api-client-react";
import { AppNav } from "@/components/app-nav";

const OPTIONS: { value: "off" | "weekly" | "monthly"; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function Segmented({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: "off" | "weekly" | "monthly") => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-surface/60 p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={
            "px-4 py-1.5 rounded-full font-sans text-sm transition-colors " +
            (value === o.value
              ? "bg-deep-brown text-background"
              : "text-soft-ink hover:text-ink")
          }
          data-testid={`freq-${o.value}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetNotifications();
  const update = useUpdateNotifications();

  async function save(patch: NotificationUpdate) {
    await update.mutateAsync({ data: patch });
    queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        <Link
          href="/settings"
          className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
        >
          ← Settings
        </Link>

        <h1 className="font-display text-4xl text-deep-brown mt-8 mb-3">
          Nudges
        </h1>
        <p className="font-body text-soft-ink leading-relaxed mb-10 max-w-[34rem]">
          Gentle, never guilt. No streaks, no "you missed a day." Just a quiet
          note now and then, and only when there's something honest to send.
          Both are off unless you turn them on.
        </p>

        {isLoading ? (
          <p className="font-sans text-sm text-faint-ink">Loading…</p>
        ) : (
          <div className="space-y-10">
            <section className="flex flex-col gap-3">
              <div>
                <p className="font-body text-lg text-ink">A nudge to write</p>
                <p className="font-body text-sm text-soft-ink">
                  “What wants to be written today?”, a small invitation, by email.
                </p>
              </div>
              <Segmented
                value={data?.writingFrequency}
                onChange={(v) => save({ writingFrequency: v })}
              />
            </section>

            <section className="flex flex-col gap-3 pt-8 border-t border-border/60">
              <div>
                <p className="font-body text-lg text-ink">A page brought back</p>
                <p className="font-body text-sm text-soft-ink">
                  Yadegar reads across your years and emails you one page worth
                  returning to, or stays quiet when nothing honest surfaces.
                </p>
              </div>
              <Segmented
                value={data?.memoryFrequency}
                onChange={(v) => save({ memoryFrequency: v })}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
