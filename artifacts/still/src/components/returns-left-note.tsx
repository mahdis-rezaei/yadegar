import { Link } from "wouter";
import { useAuth } from "@/lib/auth";

// A quiet "returns left this month" cue — the gentle priming step of the funnel.
// Deliberately NOT a persistent counter: it appears only in the decision zone
// (down to the last return, or out) and only when the limit is actually enforced
// (never in shadow, where it would imply a wall that isn't there). Members and
// users with returns to spare see nothing.
export function ReturnsLeftNote() {
  const { user } = useAuth();
  const u = user?.usage;
  if (!u || !u.enforced || u.limit == null) return null;

  const remaining = Math.max(0, u.limit - u.used);
  if (remaining > 1) return null;

  return (
    <p className="font-sans text-xs text-faint-ink mt-3" data-testid="returns-left">
      {remaining === 0 ? (
        <>
          You've used this month's returns. Revisiting what's returned is always
          free, or{" "}
          <Link
            href="/settings/plan"
            className="text-accent-sepia hover:text-deep-brown underline underline-offset-2"
          >
            become a member
          </Link>{" "}
          for unlimited.
        </>
      ) : (
        <>
          1 return left this month.{" "}
          <Link
            href="/settings/plan"
            className="text-accent-sepia hover:text-deep-brown underline underline-offset-2"
          >
            See membership
          </Link>
        </>
      )}
    </p>
  );
}
