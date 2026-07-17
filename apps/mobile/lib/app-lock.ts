import AsyncStorage from "@react-native-async-storage/async-storage";

// App lock preference — whether THIS device requires Face ID / Touch ID / the
// device passcode to open the journal. Device-local (not a server/account
// setting) and OPT-IN: off until the user turns it on in Settings. The actual
// gate lives in lib/biometric-lock.tsx; this just stores the choice.

const KEY = "yadegar.appLock.enabled";

export async function getAppLockEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, enabled ? "1" : "0");
  } catch {
    // best-effort; a write failure just means the default (off) persists
  }
}
