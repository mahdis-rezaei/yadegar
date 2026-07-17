import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Text } from "../../components/text";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  bringPageBack,
  revisitTime,
  thenAndNow,
  listEntryYears,
  getLookBack,
  type DateMemory,
} from "../../lib/memories";
import { useRun, RunResult } from "../../components/memory-run";
import { getMonthEntries, type CalendarEntry } from "../../lib/extras";
import { EntryRefCard } from "../../components/entry-ref-card";

// Look back mirrors the web: three quiet tabs of engine reads —
//  · What keeps returning (the cross-time thread + a page you'd forgotten)
//  · Revisit a time (a chosen month, and how far you've come from a past year)
//  · Your Year in Pages (a whole year gathered to read)
// Each read is button-to-surface (the engine never speaks unbidden) and stays
// honestly silent when nothing real surfaces.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Tab = "returning" | "revisit" | "year";

function PillButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
      className="self-start rounded-full border border-border bg-surface px-5 py-3"
    >
      <Text className="text-soft-ink">{label}</Text>
    </Pressable>
  );
}

// A horizontal chip selector (no native picker dependency).
function Chips<T extends string | number>({
  options,
  value,
  onChange,
  labelOf,
}: {
  options: T[];
  value: T | null;
  onChange: (v: T) => void;
  labelOf: (v: T) => string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2">
        {options.map((o) => {
          const sel = o === value;
          return (
            <Pressable
              key={String(o)}
              onPress={() => onChange(o)}
              className={
                "rounded-full border px-4 py-2 " +
                (sel ? "bg-deep-brown border-deep-brown" : "bg-surface border-border")
              }
            >
              <Text
                style={{ fontSize: 13 }}
                className={sel ? "text-background" : "text-soft-ink"}
              >
                {labelOf(o)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

// The big title that opens each tab — mirrors the Explore views, where the
// sub-view (Library / Your shelf / …) carries the page heading itself.
function LeadHeading({ title, body }: { title: string; body: string }) {
  return (
    <View className="mb-6">
      <Text className="text-4xl text-deep-brown">{title}</Text>
      <Text className="text-soft-ink mt-1 leading-relaxed">{body}</Text>
    </View>
  );
}

// A secondary heading within a tab (the second read under a lead section).
function SectionHeading({ title, body }: { title: string; body: string }) {
  return (
    <View className="mb-4">
      <Text className="text-2xl text-deep-brown">{title}</Text>
      <Text className="text-soft-ink mt-1 leading-relaxed">{body}</Text>
    </View>
  );
}

export default function LookBack() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("returning");
  const [years, setYears] = useState<number[]>([]);
  const [forgotten, setForgotten] = useState<DateMemory[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        setYears(await listEntryYears());
      } catch {
        // selectors stay hidden until years load
      }
      try {
        setForgotten((await getLookBack()).forgotten);
      } catch {
        // forgotten section stays empty
      }
    })();
  }, []);

  // What keeps returning + A page you'd forgotten.
  const wkr = useRun();
  const forg = useRun();
  const [forgIdx, setForgIdx] = useState(-1);

  function showForgotten() {
    if (forgotten.length === 0) return;
    let next = Math.floor(Math.random() * forgotten.length);
    if (forgotten.length > 1 && next === forgIdx) next = (next + 1) % forgotten.length;
    setForgIdx(next);
    const entry = forgotten[next];
    void forg.run(() => bringPageBack({ entryIds: [entry.entryId] }));
  }

  // Revisit a time + How far you've come.
  const revisit = useRun();
  const [rMonth, setRMonth] = useState<number | null>(null);
  const [rYear, setRYear] = useState<number | null>(null);
  // The month's pages, listed below the voiced read (as on the web).
  const [revisitPages, setRevisitPages] = useState<CalendarEntry[] | null>(null);

  async function runRevisit() {
    if (!rMonth || !rYear) return;
    setRevisitPages(null);
    const [, pages] = await Promise.all([
      revisit.run(() => revisitTime(rYear, rMonth)),
      getMonthEntries(rYear, rMonth).catch(() => [] as CalendarEntry[]),
    ]);
    setRevisitPages(pages);
  }
  const thenNow = useRun();
  const [tYear, setTYear] = useState<number | null>(null);
  const pastYears = years.filter((y) => y !== new Date().getFullYear());

  // Your Year in Pages.
  const [yYear, setYYear] = useState<number | null>(null);
  const pickedYear =
    yYear ?? years.find((y) => y <= new Date().getFullYear()) ?? years[0] ?? null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "returning", label: "What returns" },
    { key: "revisit", label: "Revisit" },
    { key: "year", label: "Year in Pages" },
  ];

  return (
    <ScrollView
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: 14,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 48,
      }}
    >
      {/* Sub-tabs — a quiet text nav, mirroring Explore: no page title, each
          tab carries its own heading just like the Library / Shelf views. */}
      <View className="border-b border-border/60">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 20 }}
        >
          {TABS.map((t) => {
            const sel = t.key === tab;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} className="py-3">
                <Text
                  style={{ fontSize: 15 }}
                  className={sel ? "text-ink" : "text-soft-ink"}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {tab === "returning" && (
        <View className="mt-6">
          <LeadHeading
            title="What keeps returning"
            body="Across years of pages, the same things quietly resurface — a worry, a hope, a line you keep coming back to. Yadegar reads your whole archive and brings back one thread worth sitting with."
          />
          {!wkr.pending && !wkr.result ? (
            <PillButton
              label="✦ Show me what keeps returning"
              onPress={() => void wkr.run(() => bringPageBack({}))}
            />
          ) : null}
          <RunResult pending={wkr.pending} elapsed={wkr.elapsed} result={wkr.result} />
          {!wkr.pending && wkr.result?.surfaced ? (
            <Pressable
              onPress={() => void wkr.run(() => bringPageBack({ fresh: true }))}
              className="mt-3 self-start"
            >
              <Text className="text-faint-ink" style={{ fontSize: 13 }}>
                show another →
              </Text>
            </Pressable>
          ) : null}

          <View className="mt-12">
            <SectionHeading
              title="A page you'd forgotten"
              body="Or let an old page find you — one that's slipped out of view, read back in Yadegar's voice."
            />
            {forgotten.length === 0 ? (
              <Text className="text-faint-ink leading-relaxed">
                As your pages span more years, forgotten ones will surface here.
              </Text>
            ) : (
              <>
                {!forg.pending && !forg.result ? (
                  <PillButton
                    label="✦ Bring back a page you'd forgotten"
                    onPress={showForgotten}
                  />
                ) : null}
                <RunResult
                  pending={forg.pending}
                  elapsed={forg.elapsed}
                  result={forg.result}
                />
                {!forg.pending && forg.result && forgotten.length > 1 ? (
                  <Pressable onPress={showForgotten} className="mt-3 self-start">
                    <Text className="text-faint-ink" style={{ fontSize: 13 }}>
                      show another →
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        </View>
      )}

      {tab === "revisit" && (
        <View className="mt-6">
          <LeadHeading
            title="Revisit a time"
            body="Pick a month and year, and Yadegar reads that stretch of your life back to you in your own words. A way to return somewhere on purpose."
          />
          {years.length === 0 ? (
            <Text className="text-faint-ink leading-relaxed">
              Once you have a few months of pages, you can revisit any of them here.
            </Text>
          ) : (
            <>
              <Text className="text-soft-ink mb-2" style={{ fontSize: 13 }}>
                Month
              </Text>
              <Chips
                options={MONTHS.map((_, i) => i + 1)}
                value={rMonth}
                onChange={setRMonth}
                labelOf={(m) => MONTHS[m - 1]}
              />
              <Text className="text-soft-ink mt-3 mb-2" style={{ fontSize: 13 }}>
                Year
              </Text>
              <Chips options={years} value={rYear} onChange={setRYear} labelOf={String} />
              <View className="mt-4">
                <PillButton
                  label={revisit.pending ? "Reading…" : "Show me"}
                  disabled={!rMonth || !rYear || revisit.pending}
                  onPress={() => void runRevisit()}
                />
              </View>
              <RunResult
                pending={revisit.pending}
                elapsed={revisit.elapsed}
                result={revisit.result}
              />

              {!revisit.pending && revisitPages ? (
                revisitPages.length > 0 ? (
                  <View className="mt-8">
                    <Text className="text-lg text-deep-brown mb-3">
                      {revisitPages.length}{" "}
                      {revisitPages.length === 1 ? "page" : "pages"} from{" "}
                      {rMonth ? MONTHS[rMonth - 1] : ""} {rYear}
                    </Text>
                    <View className="gap-4">
                      {revisitPages.map((e) => (
                        <EntryRefCard
                          key={e.id}
                          entryId={e.id}
                          title={e.title ?? null}
                          excerpt={e.body}
                          entryDate={e.entryDate}
                          favorite={e.favorite}
                        />
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text className="text-soft-ink leading-relaxed mt-3">
                    No pages from that month — try another.
                  </Text>
                )
              ) : null}
            </>
          )}

          {pastYears.length > 0 ? (
            <View className="mt-12">
              <SectionHeading
                title="How far you've come"
                body="Or choose a past year, and Yadegar holds it up against where you are now — the distance you've travelled since."
              />
              <Chips options={pastYears} value={tYear} onChange={setTYear} labelOf={String} />
              <View className="mt-4">
                <PillButton
                  label={thenNow.pending ? "Reading…" : "Show me"}
                  disabled={!tYear || thenNow.pending}
                  onPress={() => tYear && void thenNow.run(() => thenAndNow(tYear))}
                />
              </View>
              <RunResult
                pending={thenNow.pending}
                elapsed={thenNow.elapsed}
                result={thenNow.result}
              />
            </View>
          ) : null}
        </View>
      )}

      {tab === "year" && (
        <View className="mt-6">
          <LeadHeading
            title="Your Year in Pages"
            body="A whole year of your writing, gathered into one place to read straight through. The keepsake at the heart of Yadegar."
          />
          {years.length === 0 ? (
            <Text className="text-faint-ink leading-relaxed">
              Once you've written across a year, you can gather it into a book here.
            </Text>
          ) : (
            <>
              {years.length > 1 ? (
                <>
                  <Text className="text-soft-ink mb-2" style={{ fontSize: 13 }}>
                    Year
                  </Text>
                  <Chips options={years} value={pickedYear} onChange={setYYear} labelOf={String} />
                </>
              ) : null}
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(app)/year",
                    params: pickedYear ? { year: String(pickedYear) } : {},
                  })
                }
                className="mt-4 rounded-3xl border border-border bg-surface px-6 py-5"
              >
                <Text className="text-3xl text-deep-brown">{pickedYear} →</Text>
                <Text className="text-soft-ink mt-1 leading-relaxed">
                  Open this year as a single, readable letter.
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      <Pressable
        onPress={() => router.push("/(app)/returns")}
        className="mt-12 self-start"
      >
        <Text className="text-soft-ink" style={{ fontSize: 13 }}>
          Everything Yadegar has brought back is kept in your Returns →
        </Text>
      </Pressable>
    </ScrollView>
  );
}
