import { ScrollView, View } from "react-native";
import { Text } from "./text";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// "why I built Yadegar" — the maker's note, Mahdis's words, unchanged. A calm
// reading page mirroring the web /why (without the scroll animations). Shared by
// the signed-in route (app)/why and the signed-out route (auth)/why so the
// landing's "Why I built this" stays native instead of opening a web view.

type Block =
  | { kind: "stanza"; lines: string[]; lead?: boolean }
  | { kind: "quote"; text: string }
  | { kind: "whisper"; lines: string[] }
  | { kind: "reveal" }
  | { kind: "rule" };

const NOTE: Block[] = [
  {
    kind: "stanza",
    lead: true,
    lines: [
      "When I was a child, every year I got a new journal.",
      "Some were simple notebooks.",
      "Some had little locks on them.",
      "I loved those ones.",
      "I remember holding the tiny key in my hand and feeling like I had a secret world that belonged only to me.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Inside those pages lived everything.",
      "School.",
      "Friends.",
      "Crushes.",
      "Big dreams.",
      "Very dramatic heartbreaks.",
      "Questions about life that I was certain nobody else had ever asked before.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "I wrote when I was excited.",
      "I wrote when I was confused.",
      "I wrote when I was lonely.",
      "I wrote when I had nowhere else to put what I was feeling.",
      "I didn't know it then, but I was building a conversation with myself.",
      "One that would last decades.",
    ],
  },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "Over the years, the journals followed me everywhere.",
      "Across countries.",
      "Across languages.",
      "Across versions of myself.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "A little girl in Iran.",
      "A teenager trying to understand the world.",
      "A young woman leaving home.",
      "An immigrant trying to build a life.",
      "Someone falling in love.",
      "Someone getting her heart broken.",
      "Someone sitting on a train, writing because there was too much happening inside her chest.",
      "Someone awake at three in the morning asking questions she couldn't answer.",
    ],
  },
  { kind: "stanza", lines: ["And through all of it, I kept writing."] },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "Some of those journals are gone now.",
      "Lost during moves.",
      "Thrown away by mistake.",
      "Left behind somewhere between one version of my life and the next.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Nobody meant harm.",
      "Life was happening.",
      "Boxes were being packed.",
      "There was never enough room for everything.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "But sometimes I think about those notebooks and feel a quiet ache.",
      "Not because I think they were brilliant.",
      "Most of them were probably messy and dramatic and full of terrible handwriting.",
      "But they held people I can no longer fully reach.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "A twelve-year-old me.",
      "A seventeen-year-old me.",
      "A twenty-one-year-old me.",
      "Entire worlds that existed for a little while and then disappeared into time.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "I wish I could sit beside them sometimes.",
      "Just for an afternoon.",
      "Not to change anything.",
      "Just to listen.",
    ],
  },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "I have lived in many places since then.",
      "Iran.",
      "New Delhi.",
      "Malaysia.",
      "Rome.",
      "London.",
      "New York.",
      "Los Angeles.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Each place changed me.",
      "Each place left something behind.",
      "And after enough years, enough moves, enough becoming, I started noticing something.",
      "It is surprisingly easy to lose touch with your own story.",
    ],
  },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "So I kept writing.",
      "In journals.",
      "In notebooks.",
      "In iPhone Notes.",
      "In Google Docs.",
      "In emails to myself.",
      "In the margins of books.",
      "Sometimes at a desk.",
      "Sometimes on a plane.",
      "Sometimes in a bathtub before sunrise, holding a cup of coffee and trying to understand why my heart felt heavy.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Every Christmas, I still buy myself a new journal.",
      "Over the years I started buying them for my siblings and close friends too.",
      "A journal has always felt like one of the most loving gifts you can give someone.",
      "Not because it gives answers.",
      "Because it says:",
    ],
  },
  { kind: "whisper", lines: ["Here.", "This is a place where all of you gets to exist."] },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "Years ago, I kept returning to a poem by Sohrab Sepehri.",
      "I copied parts of it into my journals again and again.",
      "One line stayed with me:",
    ],
  },
  { kind: "quote", text: "We must wash our eyes and see differently." },
  {
    kind: "stanza",
    lines: [
      "At the time, I thought it was a poem about the world.",
      "Now I wonder if it is also a poem about memory.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Because something strange happens when you return to an old journal.",
      "The page has not changed.",
      "The words have not changed.",
      "But you have.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "You find a sentence you forgot you wrote.",
      "You meet a younger version of yourself.",
      "You notice a fear that no longer owns you.",
      "A dream that somehow survived.",
      "A question that followed you across years.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "Sometimes your heart breaks a little.",
      "Sometimes you laugh.",
      "Sometimes you want to reach through time and hug the person who wrote those words.",
      "And sometimes you realize she was doing much better than she thought.",
    ],
  },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "I think that feeling is what led me to build Yadegar.",
      "Not a tool that tells you what your life means.",
      "Not a tool that turns your memories into lessons.",
      "Just a companion.",
      "Something that can sit beside years of journals and gently place a page back in front of you.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "A line.",
      "A memory.",
      "A question.",
      "A version of yourself.",
      "Something waiting quietly for years to be seen again.",
    ],
  },
  { kind: "reveal" },

  { kind: "rule" },

  {
    kind: "stanza",
    lines: [
      "Because so much changes.",
      "Countries change.",
      "Jobs change.",
      "Relationships change.",
      "Dreams change.",
      "We change.",
    ],
  },
  {
    kind: "stanza",
    lines: [
      "And yet, when I return to my journals, I almost always find something that is still there.",
      "A hope.",
      "A fear.",
      "A question.",
      "A way of speaking to myself.",
      "A voice saying:",
    ],
  },
  { kind: "whisper", lines: ["Hi my dear one.", "Come sit next to me.", "I'm here."] },
  {
    kind: "stanza",
    lines: [
      "And sometimes all it takes is one old sentence to remember who you were, how you felt, and how far you have come.",
    ],
  },
];

function renderBlock(block: Block, i: number) {
  if (block.kind === "rule") {
    return (
      <View key={i} className="items-center py-1">
        <View style={{ width: 40, height: 1, backgroundColor: "#E0D6C4" }} />
      </View>
    );
  }
  if (block.kind === "quote") {
    return (
      <View key={i} className="items-center py-2">
        <Text className="text-2xl italic text-deep-brown leading-snug text-center">
          “{block.text}”
        </Text>
      </View>
    );
  }
  if (block.kind === "whisper") {
    return (
      <View key={i} className="items-center py-2 gap-1.5">
        {block.lines.map((line, j) => (
          <Text key={j} className="text-xl italic text-deep-brown leading-snug text-center">
            {line}
          </Text>
        ))}
      </View>
    );
  }
  if (block.kind === "reveal") {
    return (
      <View key={i} className="gap-1.5">
        <Text className="text-xl text-soft-ink leading-relaxed">
          And perhaps that is why I called this{" "}
          <Text className="italic text-deep-brown">Yadegar</Text>.
        </Text>
        <Text className="text-xl text-soft-ink leading-relaxed">
          In Persian, it means a keepsake, the thing that remains.
        </Text>
      </View>
    );
  }
  return (
    <View key={i} className="gap-1.5">
      {block.lines.map((line, j) => (
        <Text
          key={j}
          className={"text-xl leading-relaxed " + (block.lead ? "text-ink" : "text-soft-ink")}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

// The maker's note, as a scrollable reading page. `topInset` lets the signed-out
// screen leave room for its back button; the signed-in screen uses the default.
export function WhyNote({ topInset = 24 }: { topInset?: number }) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: topInset,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 64,
      }}
    >
      <Text className="text-xs uppercase tracking-widest text-faint-ink mb-4">
        A note from the maker
      </Text>
      <Text className="text-5xl text-deep-brown leading-tight mb-12">
        why I built Yadegar
      </Text>

      <View className="gap-9">{NOTE.map((b, i) => renderBlock(b, i))}</View>

      <View className="h-px bg-border my-12" />
      <Text className="text-xl italic text-soft-ink">Mahdis</Text>
    </ScrollView>
  );
}
