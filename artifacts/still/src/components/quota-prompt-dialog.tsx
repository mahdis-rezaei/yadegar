import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  registerQuotaPromptHandler,
  type QuotaPromptPayload,
} from "@/lib/quota-prompt";

// The one shared upgrade prompt for the free-tier quota. Mounted once at the app
// root; any run surface that hits the quota 402 raises it via triggerQuotaPrompt
// (see lib/quota-prompt). DORMANT in shadow mode, the server only returns 402
// once enforcement is on, so this never appears until membership is purchasable.
//
// On-brand: it never scolds and never walls the journal. It names the one thing
// that's limited (bringing a NEW page back) and reassures that revisiting what has
// already returned is always free. The membership CTA is honest for the pre-Stripe
// state: it says membership is coming, with no fake checkout.
export function QuotaPromptProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<QuotaPromptPayload | null>(null);

  useEffect(
    () => registerQuotaPromptHandler((p) => setPayload(p)),
    [],
  );

  return (
    <>
      {children}
      <Dialog open={payload != null} onOpenChange={(open) => !open && setPayload(null)}>
        <DialogContent className="max-w-md border-border bg-background rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-body text-xl text-ink font-normal">
              This month's returns
            </DialogTitle>
            <DialogDescription className="font-body text-soft-ink leading-relaxed pt-1">
              {payload?.message ??
                "You've used this month's returns. Revisiting what's already returned to you is always free."}
            </DialogDescription>
          </DialogHeader>

          <p className="font-body text-sm text-soft-ink leading-relaxed">
            Your journal is always yours, writing, keeping, and revisiting the
            pages that have come back to you stay free and unlimited. Membership,
            for unlimited fresh returns across your years, is coming soon.
          </p>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setPayload(null)}
              className="font-sans text-sm text-soft-ink hover:text-ink transition-colors rounded-full px-4 py-2 border border-border hover:border-accent-sepia"
              data-testid="quota-dismiss"
            >
              Maybe later
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
