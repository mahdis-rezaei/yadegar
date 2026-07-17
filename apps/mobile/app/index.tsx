import { Redirect } from "expo-router";

// The gate in _layout handles the signed-out case; this just lands signed-in
// users on Today.
export default function Index() {
  return <Redirect href="/(app)/today" />;
}
