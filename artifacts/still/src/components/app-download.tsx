import { useEffect, useState } from "react";
import {
  APP_STORE_LIVE,
  APP_STORE_URL,
  detectPlatform,
  type DevicePlatform,
} from "@/lib/app-store";

// Download-the-app CTAs for the public web. Everything here renders ONLY when
// APP_STORE_LIVE is on (see lib/app-store.ts) — gated so we never link visitors
// to an App Store listing that doesn't exist yet.

// "Download on the App Store" badge. This is a faithful inline rendition of
// Apple's badge for layout; before launch, swap in Apple's OFFICIAL artwork
// (developer.apple.com → marketing guidelines) to comply with their badge rules.
function AppStoreBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download Yadegar on the App Store"
      data-testid="link-app-store"
      className={`inline-flex items-center gap-2.5 rounded-xl bg-ink px-4 py-2.5 text-background transition-colors hover:bg-deep-brown ${className}`}
    >
      <svg
        viewBox="0 0 384 512"
        width="22"
        height="22"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C61.1 141.6 11.4 184.6 11.4 271.6c0 25.7 4.7 52.2 14.1 79.5 12.6 35.5 58 122.6 105.4 121.1 24.8-.6 42.3-17.6 74.5-17.6 31.2 0 47.4 17.6 75.5 17.6 47.8-.7 88.9-79.8 100.9-115.4-64.1-30.2-60.8-88.5-60.8-90.1zm-52.5-164.4c25.3-30 23-57.3 22.3-67.1-22.4 1.3-48.3 15.3-63.1 32.5-16.3 18.4-25.9 41.2-23.8 65.9 24.2 1.9 46.3-10.6 64.6-31.3z" />
      </svg>
      <span className="flex flex-col leading-none text-left">
        <span className="font-sans text-[10px] opacity-80">Download on the</span>
        <span className="font-sans text-base font-semibold -mt-0.5">App Store</span>
      </span>
    </a>
  );
}

// Platform-aware download invitation. On a phone we lead with the badge; on a
// desktop we invite the visitor to open it on their iPhone. Invite, never force:
// no full-screen interstitial, and web sign-in stays available alongside.
export function AppDownloadCTA({ className = "" }: { className?: string }) {
  const [platform, setPlatform] = useState<DevicePlatform>("desktop");
  useEffect(() => setPlatform(detectPlatform()), []);

  if (!APP_STORE_LIVE) return null;

  if (platform === "ios") {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <AppStoreBadge />
        <span className="font-sans text-xs text-faint-ink">
          Yadegar for iPhone
        </span>
      </div>
    );
  }

  // Desktop / Android: offer the badge and tell them where it lives. (A scan-to-
  // download QR is a planned follow-up — render it here with a local generator,
  // e.g. qrcode.react, to avoid leaking visitors to a third-party QR service.)
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <AppStoreBadge />
      <span className="font-sans text-xs text-faint-ink">
        Yadegar is on iPhone — open the App Store, or keep going here on the web.
      </span>
    </div>
  );
}
