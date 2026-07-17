import { Stack } from "expo-router";

// The signed-out group: Welcome (the landing) → Sign in, as a stack so the
// sign-in screen pushes over Welcome with a native back gesture.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="why" />
    </Stack>
  );
}
