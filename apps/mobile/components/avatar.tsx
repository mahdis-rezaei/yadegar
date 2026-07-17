import { Image, View } from "react-native";
import { Text } from "./text";
import { avatarColorFor, avatarInitial } from "../lib/avatar";

// A round avatar: the user's photo (a data: URL) when set, otherwise a coloured
// circle with their initial.
export function Avatar({
  user,
  size = 84,
  colorOverride,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    avatarColor?: string | null;
    avatarUrl?: string | null;
  } | null | undefined;
  size?: number;
  colorOverride?: string;
}) {
  if (user?.avatarUrl) {
    return (
      <Image
        source={{ uri: user.avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  const color = colorOverride ?? avatarColorFor(user);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#FBF8F1", fontSize: size * 0.4 }}>
        {avatarInitial(user)}
      </Text>
    </View>
  );
}
