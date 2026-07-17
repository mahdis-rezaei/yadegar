import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from "react-native";
import { cssInterop } from "nativewind";

// Brand typography to match the web: Fraunces (display) · Newsreader (body) ·
// Inter (UI). The TTFs in assets/fonts are embedded at build time by the
// expo-font config plugin (app.json) and register under their PostScript names
// (the filenames). React Native won't auto-swap weight/italic font files like a
// browser, so this <Text> picks the right face by role — inferred from size +
// weight + style — unless a fontFamily is set explicitly. Screens import Text
// from here instead of react-native: on RN 0.81 the core <Text> is a plain
// function component (no forwardRef, no `.render`), so the old global
// Text.render patch can never apply again.

function pickFamily(flat: TextStyle): string {
  const size = typeof flat.fontSize === "number" ? flat.fontSize : undefined;
  const w = flat.fontWeight;
  const bold =
    w === "bold" ||
    w === "600" || w === "700" || w === "800" || w === "900" ||
    (typeof w === "number" && w >= 600);
  const medium = w === "500" || w === "600" || (typeof w === "number" && w >= 500);
  const italic = flat.fontStyle === "italic";

  // Large text → Fraunces (the display face, like the web's headings & wordmark).
  if (size != null && size >= 22) return "Fraunces-SemiBold";
  // Small text → Inter (UI labels, chips, tab labels).
  if (size != null && size <= 13) return bold || medium ? "Inter-SemiBold" : "Inter-Regular";
  // Body → Newsreader, honouring italic / weight.
  if (italic) return "Newsreader-Italic";
  if (bold) return "Newsreader-SemiBold";
  if (medium) return "Newsreader-Medium";
  return "Newsreader-Regular";
}

export function Text(props: TextProps) {
  const flat = (StyleSheet.flatten(props.style) ?? {}) as TextStyle;
  // Respect an explicit fontFamily; otherwise pick by role.
  if (flat.fontFamily) return <RNText {...props} />;
  return <RNText {...props} style={[{ fontFamily: pickFamily(flat) }, props.style]} />;
}

// Register with NativeWind so className resolves to a style prop BEFORE this
// wrapper runs — pickFamily must see the final fontSize/weight/style.
cssInterop(Text, { className: "style" });
