import { useEffect, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  View,
} from "react-native";
import { Text } from "./text";

// Dismissing the keyboard on a MULTILINE input (where Return makes a new line, as
// journaling needs) is awkward on iOS: the standard InputAccessoryView "Done" bar
// is NOT supported for multiline TextInputs, so it never renders. <KeyboardDoneBar/>
// is our own floating bar that tracks the keyboard height and sits just above it.
// Render it as the LAST child of a full-screen container so its absolute bottom
// positions relative to the whole screen.
export function KeyboardDoneBar() {
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) =>
      setKbHeight(e.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (kbHeight <= 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: kbHeight }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          backgroundColor: "#FFFDF8",
          borderTopWidth: 1,
          borderTopColor: "#E6DCC9",
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={10}>
          <Text style={{ color: "#3A2F25", fontSize: 16, fontWeight: "600" }}>
            Done
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Legacy InputAccessoryView "Done" bar — kept so other screens still compile while
// they migrate to <KeyboardDoneBar/>. (Doesn't render on multiline inputs.)
export const KEYBOARD_DONE_ID = "yadegar-keyboard-done";

export function KeyboardDone() {
  if (Platform.OS !== "ios") return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          backgroundColor: "#FFFDF8",
          borderTopWidth: 1,
          borderTopColor: "#E6DCC9",
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={10}>
          <Text style={{ color: "#3A2F25", fontSize: 16, fontWeight: "600" }}>
            Done
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
