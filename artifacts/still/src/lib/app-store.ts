// App Store presence for the public web → native app download path.
//
// The iOS app is LIVE on the App Store, so the download CTAs show by default.
// Kill switch: set VITE_APP_STORE_LIVE="0" in Replit (and rebuild) to hide them
// again if ever needed (e.g. the listing is pulled).

export const IOS_APP_ID = "6778475173";
export const APP_STORE_URL = `https://apps.apple.com/app/id${IOS_APP_ID}`;

// Live unless explicitly disabled with VITE_APP_STORE_LIVE="0".
export const APP_STORE_LIVE = import.meta.env.VITE_APP_STORE_LIVE !== "0";

export type DevicePlatform = "ios" | "android" | "desktop";

// Best-effort platform sniff for choosing the right CTA (a phone gets the store
// badge; a desktop gets "open on your phone"). Never used for anything load-
// bearing, so a wrong guess only changes which invitation we show.
export function detectPlatform(): DevicePlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports as Mac; the touch-point check disambiguates.
  const isIPadOS =
    /Macintosh/.test(ua) &&
    typeof document !== "undefined" &&
    "ontouchend" in document;
  if (/iPhone|iPad|iPod/.test(ua) || isIPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}
