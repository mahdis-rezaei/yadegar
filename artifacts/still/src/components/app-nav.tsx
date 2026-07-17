import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useResendVerification } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/avatar";

// Explore = your archive + keepsakes, shown as in-page sub-tabs (not a dropdown).
const EXPLORE_TABS = [
  { href: "/library", label: "Library" },
  { href: "/shelf", label: "Shelf" },
  { href: "/collections", label: "Collections" },
  { href: "/capsules", label: "Capsules" },
];
// Look back = the three ways your past returns to you, in the same contextual
// sub-bar pattern as Explore (real routes, not wrapping in-page tabs).
const LOOK_BACK_TABS = [
  { href: "/look-back", label: "What keeps returning" },
  { href: "/look-back/revisit", label: "Revisit a time" },
  { href: "/look-back/keepsake", label: "Your Year in Pages" },
];
// The quiet top bar for the signed-in app. Three calm destinations by intent, // Today (write), Look back (be visited by your past), Explore (your archive), // with account/settings on the right. A contextual second bar appears under
// Explore for its sub-tabs. Plus a soft "confirm your email" banner.
export function AppNav() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const resend = useResendVerification();
  const [resent, setResent] = useState(false);

  // Clicking the logo or the already-active nav item shouldn't dead-end: scroll to
  // the top and soft-refresh the page's data (refetch active queries) — the
  // standard "tap the active tab again" gesture. Not a full reload (that flashes
  // and would feel heavy); just a calm refresh.
  function refreshCurrent() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    queryClient.invalidateQueries();
  }

  // Account menu, one dropdown on the right (Settings · About · Profile · Sign
  // out) instead of scattering them across the top bar. Closes on outside click
  // or Escape.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const menuItem = (href: string, label: string) => (
    <Link
      href={href}
      onClick={() => setMenuOpen(false)}
      role="menuitem"
      className="block px-4 py-2 font-sans text-sm text-soft-ink hover:text-ink hover:bg-background/70 transition-colors"
      data-testid={`account-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
    </Link>
  );

  // Mobile menu, on phones the inline nav doesn't fit, so it collapses into a
  // hamburger. Closes on navigation or Escape.
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [location]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const mobileItem = (href: string, label: string, active = false) => (
    <Link
      href={href}
      onClick={() => setMobileOpen(false)}
      className={
        "py-2.5 font-sans text-base transition-colors " +
        (active ? "text-ink" : "text-soft-ink hover:text-ink")
      }
      data-testid={`mobilenav-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
    </Link>
  );

  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  const inLibrary =
    isActive("/library") ||
    isActive("/calendar") ||
    isActive("/timeline") ||
    isActive("/search");
  const exploreActive =
    inLibrary ||
    isActive("/shelf") ||
    isActive("/collections") ||
    isActive("/capsules");
  // Returns lives under Look back (until the Look back home absorbs it).
  const lookBackActive = isActive("/look-back") || isActive("/returns");
  // The default lens ("What keeps returning") is the bare /look-back path; the
  // other two are sub-routes, so match it exactly to avoid lighting up all three.
  const lookBackTabActive = (href: string) =>
    href === "/look-back" ? location === "/look-back" : isActive(href);

  const navLink = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      onClick={(e) => {
        // Exactly here already? Don't dead-click — scroll up + soft-refresh.
        // (A sub-route like /look-back/revisit still navigates to the base.)
        if (location === href) {
          e.preventDefault();
          refreshCurrent();
        }
      }}
      className={
        "font-sans text-sm transition-colors " +
        (active ? "text-ink" : "text-soft-ink hover:text-ink")
      }
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
    </Link>
  );

  const subTab = (href: string, label: string, active: boolean) => (
    <Link
      key={href + label}
      href={href}
      className={
        "shrink-0 font-sans text-sm transition-colors " +
        (active ? "text-ink" : "text-soft-ink hover:text-ink")
      }
      data-testid={`subnav-${label.toLowerCase()}`}
    >
      {label}
    </Link>
  );

  // The wordmark is the home affordance (→ Today). When you're ALREADY on Today,
  // a plain link does nothing and reads as broken (you tap and nothing happens),
  // so instead scroll to the top — the logo always responds. Also closes the
  // mobile menu if it's open.
  function onWordmark(e: React.MouseEvent) {
    setMobileOpen(false);
    if (location === "/today") {
      e.preventDefault();
      refreshCurrent();
    }
  }

  async function handleResend() {
    try {
      await resend.mutateAsync();
    } finally {
      setResent(true);
    }
  }

  return (
    <>
      <nav className="w-full flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/60">
        <div className="flex items-center gap-8">
          <Link
            href="/today"
            onClick={onWordmark}
            aria-label="Yadegar, home"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            {/* The Persian glyph as a small logomark, echoing the landing hero.
                Decorative (the English wordmark + aria-label carry the name). */}
            <span
              className="font-display text-base text-accent-sepia/70 leading-none"
              dir="rtl"
              lang="fa"
              aria-hidden="true"
            >
              یادگار
            </span>
            <span className="font-display text-xl text-deep-brown tracking-tight leading-none">
              Yadegar
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-5 md:gap-6">
            {navLink("/today", "Today", isActive("/today"))}
            {navLink("/look-back", "Look back", lookBackActive)}
            {navLink("/library", "Explore", exploreActive)}
            {navLink("/shop", "Shop", isActive("/shop"))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Desktop account menu */}
          <div className="relative hidden md:block" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={
                "flex items-center gap-1.5 font-sans text-sm transition-colors " +
                (isActive("/settings") || menuOpen
                  ? "text-ink"
                  : "text-soft-ink hover:text-ink")
              }
              data-testid="account-menu-trigger"
            >
              <Avatar user={user} size={26} />
              <span className="hidden sm:inline">
                {user?.name || user?.email || "Account"}
              </span>
              <span className="text-xs text-faint-ink">⌄</span>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-surface shadow-lg py-1.5 z-50"
              >
                {menuItem("/settings", "Settings")}
                {menuItem("/settings/profile", "My profile")}
                {menuItem("/settings/plan", "Membership")}
                {menuItem("/help", "Help & FAQ")}
                {menuItem("/why", "About Yadegar")}
                <div className="my-1.5 border-t border-border/60" />
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await logout();
                    setLocation("/login");
                  }}
                  role="menuitem"
                  className="w-full text-left px-4 py-2 font-sans text-sm text-soft-ink hover:text-ink hover:bg-background/70 transition-colors"
                  data-testid="button-signout"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            className="md:hidden flex items-center gap-2 p-1 -mr-1 text-soft-ink hover:text-ink transition-colors"
            data-testid="mobile-menu-trigger"
          >
            <Avatar user={user} size={26} />
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {mobileOpen ? (
                <>
                  <line x1="6" y1="6" x2="16" y2="16" />
                  <line x1="16" y1="6" x2="6" y2="16" />
                </>
              ) : (
                <>
                  <line x1="3" y1="7" x2="19" y2="7" />
                  <line x1="3" y1="11" x2="19" y2="11" />
                  <line x1="3" y1="15" x2="19" y2="15" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu panel, the full nav + account actions, hamburger-driven. */}
      {mobileOpen && (
        <div className="md:hidden w-full border-b border-border/60 bg-surface">
          <div className="px-6 py-2 flex flex-col">
            {mobileItem("/today", "Today", isActive("/today"))}
            {mobileItem("/look-back", "Look back", lookBackActive)}
            {mobileItem("/library", "Explore", exploreActive)}
            {mobileItem("/shop", "Shop", isActive("/shop"))}
            <div className="my-1 border-t border-border/60" />
            {mobileItem("/settings", "Settings", isActive("/settings"))}
            {mobileItem("/settings/profile", "My profile")}
            {mobileItem("/settings/plan", "Membership", isActive("/settings/plan"))}
            {mobileItem("/help", "Help & FAQ", isActive("/help"))}
            {mobileItem("/why", "About Yadegar")}
            <button
              onClick={async () => {
                setMobileOpen(false);
                await logout();
                setLocation("/login");
              }}
              className="py-2.5 text-left font-sans text-base text-soft-ink hover:text-ink transition-colors"
              data-testid="mobile-signout"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Explore sub-tabs, contextual second bar (in-page tabs, not a dropdown),
          aligned to the content column. (Library's own views, List/Calendar/
          Timeline, live in the page, and Search is the Library search box.) */}
      {exploreActive && (
        <div className="relative w-full border-b border-border/40 bg-surface/30">
          <div className="max-w-[680px] mx-auto px-6 py-3 flex items-center gap-5 md:gap-6 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {EXPLORE_TABS.map((t) =>
              subTab(
                t.href,
                t.label,
                t.label === "Library" ? inLibrary : isActive(t.href),
              ),
            )}
          </div>
          {/* soft right fade signals the row scrolls horizontally (mobile only) */}
          <div
            aria-hidden="true"
            className="md:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent"
          />
        </div>
      )}

      {/* Look back sub-tabs, the same contextual second bar as Explore. */}
      {lookBackActive && (
        <div className="relative w-full border-b border-border/40 bg-surface/30">
          <div className="max-w-[680px] mx-auto px-6 py-3 flex items-center gap-5 md:gap-6 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {LOOK_BACK_TABS.map((t) =>
              subTab(t.href, t.label, lookBackTabActive(t.href)),
            )}
          </div>
          <div
            aria-hidden="true"
            className="md:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent"
          />
        </div>
      )}

      {user && !user.emailVerified && (
        <div className="w-full bg-[#F3EAD7] border-b border-accent-sepia/20 px-6 md:px-8 py-2.5 text-center">
          <span className="font-sans text-xs text-deep-brown/80">
            {resent ? (
              "Sent, check your inbox to confirm your email."
            ) : (
              <>
                Confirm your email to keep your pages safe.{" "}
                <button
                  onClick={handleResend}
                  className="text-accent-sepia hover:text-deep-brown underline underline-offset-2 font-medium"
                  data-testid="button-resend-verification"
                >
                  Resend link
                </button>
              </>
            )}
          </span>
        </div>
      )}
    </>
  );
}
