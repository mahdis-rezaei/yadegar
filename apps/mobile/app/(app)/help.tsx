import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Markdown } from "../../components/markdown";
import { FAQ_MARKDOWN } from "../../lib/faq";

// Help & FAQ — the same content as docs/FAQ.md, rendered natively.
export default function Help() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: 16,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 56,
      }}
    >
      <Markdown source={FAQ_MARKDOWN} />
    </ScrollView>
  );
}
