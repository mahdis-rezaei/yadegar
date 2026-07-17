import { Pressable, View } from "react-native";
import { Text } from "./text";

// A connected segmented control (Off · Weekly · Monthly, Open · Gentle ·
// Protected…) — one rounded pill with equal segments, the selected one filled.
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row rounded-full border border-border bg-surface p-1">
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={
              "flex-1 items-center rounded-full py-2 " + (sel ? "bg-deep-brown" : "")
            }
          >
            <Text
              style={{ fontSize: 13 }}
              className={sel ? "text-background" : "text-soft-ink"}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
