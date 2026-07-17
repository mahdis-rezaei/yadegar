import { Link } from "wouter";

// A soft, warm field of color washes behind the page, three blurred blobs in
// Yadegar's palette (sepia, blush, a faint sage), drifting almost imperceptibly.
export function AmbientField() {
  return (
    <div className="ambient-field" aria-hidden="true">
      <div
        className="ambient-blob"
        style={{
          width: "46vw",
          height: "46vw",
          top: "-8%",
          left: "-6%",
          background:
            "radial-gradient(circle, rgba(168,180,150,0.45), transparent 68%)",
          animationDelay: "0s",
        }}
      />
      <div
        className="ambient-blob"
        style={{
          width: "42vw",
          height: "42vw",
          top: "-4%",
          right: "-8%",
          background:
            "radial-gradient(circle, rgba(206,170,150,0.45), transparent 68%)",
          animationDelay: "-7s",
        }}
      />
      <div
        className="ambient-blob"
        style={{
          width: "50vw",
          height: "50vw",
          bottom: "-18%",
          right: "4%",
          background:
            "radial-gradient(circle, rgba(196,178,140,0.38), transparent 70%)",
          animationDelay: "-13s",
        }}
      />
    </div>
  );
}

// A quiet top bar: the wordmark on the left, a single "Why Yadegar" link on the
// right. Used on the public landing and the maker's note.
export function SiteNav({ showWhy = true }: { showWhy?: boolean }) {
  return (
    <nav className="w-full flex items-center justify-between px-6 md:px-10 py-5">
      <Link
        href="/login"
        className="flex items-center gap-2 font-display text-xl text-deep-brown tracking-tight"
        data-testid="link-wordmark"
      >
        {/* The open-book mark (the app icon), small and quiet beside the wordmark. */}
        <img src="/logo-mark.png" alt="" aria-hidden="true" className="h-6 w-6 rounded-md" />
        Yadegar
      </Link>
      {showWhy && (
        <div className="flex items-center gap-5">
          <Link
            href="/shop"
            className="font-sans text-xs uppercase tracking-[0.18em] text-soft-ink hover:text-ink transition-colors"
            data-testid="link-shop"
          >
            Shop
          </Link>
          <Link
            href="/pricing"
            className="font-sans text-xs uppercase tracking-[0.18em] text-soft-ink hover:text-ink transition-colors"
            data-testid="link-pricing"
          >
            Pricing
          </Link>
          <Link
            href="/why"
            className="font-sans text-xs uppercase tracking-[0.18em] text-soft-ink hover:text-ink transition-colors"
            data-testid="link-why"
          >
            Why Yadegar
          </Link>
        </div>
      )}
    </nav>
  );
}
