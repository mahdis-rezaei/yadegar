import { useCart, formatMoney } from "@/lib/use-cart";

// A quiet slide-over cart. Lines with quantity steppers + remove, a subtotal, and
// a checkout button that hands off to Shopify's hosted checkout (cart.checkoutUrl).
// Rendered once at the app root; opened from any "Cart" button via useCart.
export function CartDrawer() {
  const { cart, open, setOpen, updateLine, busy } = useCart();
  const lines = cart?.lines.nodes ?? [];

  return (
    <>
      {/* scrim */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={
          "fixed inset-0 z-50 bg-black/30 transition-opacity " +
          (open ? "opacity-100" : "pointer-events-none opacity-0")
        }
      />
      {/* panel */}
      <aside
        role="dialog"
        aria-label="Cart"
        className={
          "fixed right-0 top-0 z-50 h-full w-full max-w-[400px] bg-surface border-l border-border shadow-xl flex flex-col transition-transform duration-300 " +
          (open ? "translate-x-0" : "translate-x-full")
        }
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
          <p className="font-display text-xl text-deep-brown">Your cart</p>
          <button
            onClick={() => setOpen(false)}
            className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
            data-testid="cart-close"
          >
            close
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="font-body text-soft-ink text-center">
              Your cart is empty.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {lines.map((line) => (
              <div key={line.id} className="flex gap-4">
                {line.merchandise.product.featuredImage && (
                  <img
                    src={line.merchandise.product.featuredImage.url}
                    alt={line.merchandise.product.featuredImage.altText ?? ""}
                    className="w-16 h-16 rounded-lg object-cover border border-border/60"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-body text-ink leading-snug">
                    {line.merchandise.product.title}
                  </p>
                  {line.merchandise.title !== "Default Title" && (
                    <p className="font-sans text-xs text-faint-ink">
                      {line.merchandise.title}
                    </p>
                  )}
                  <p className="font-sans text-sm text-soft-ink mt-1">
                    {formatMoney(line.merchandise.price)}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="inline-flex items-center border border-border rounded-full">
                      <button
                        onClick={() => updateLine(line.id, line.quantity - 1)}
                        disabled={busy}
                        className="px-2.5 py-1 text-soft-ink hover:text-ink disabled:opacity-50"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="px-2 font-sans text-sm text-ink tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        onClick={() => updateLine(line.id, line.quantity + 1)}
                        disabled={busy}
                        className="px-2.5 py-1 text-soft-ink hover:text-ink disabled:opacity-50"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => updateLine(line.id, 0)}
                      disabled={busy}
                      className="font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors disabled:opacity-50"
                    >
                      remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {lines.length > 0 && cart && (
          <div className="border-t border-border/60 px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-sans text-sm text-soft-ink">Subtotal</span>
              <span className="font-body text-lg text-ink">
                {formatMoney(cart.cost.subtotalAmount)}
              </span>
            </div>
            <a
              href={cart.checkoutUrl}
              className="block text-center w-full rounded-full bg-deep-brown text-background py-3 font-sans text-sm hover:bg-ink transition-colors"
              data-testid="cart-checkout"
            >
              Checkout
            </a>
            <p className="font-sans text-xs text-faint-ink text-center mt-3">
              Taxes &amp; shipping calculated at checkout.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

// A small "Cart (n)" button that opens the drawer. Used in the shop header.
export function CartButton() {
  const { cart, setOpen } = useCart();
  const count = cart?.totalQuantity ?? 0;
  return (
    <button
      onClick={() => setOpen(true)}
      className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
      data-testid="cart-button"
    >
      Cart{count > 0 ? ` (${count})` : ""}
    </button>
  );
}
