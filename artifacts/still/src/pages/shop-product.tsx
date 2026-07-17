import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { AmbientField } from "@/components/site-chrome";
import { CartButton } from "@/components/cart-drawer";
import { useCart, formatMoney, type ShopProduct } from "@/lib/use-cart";

// Product detail (PDP): gallery, variant + quantity selection, add-to-cart, and a
// short brand note (the "why it's on the desk" curation angle). Headless via
// /api/shop/products/:handle.
function ShopHeader() {
  return (
    <nav className="w-full flex items-center justify-between px-6 md:px-10 py-5">
      <Link
        href="/shop"
        className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
      >
        ← The desk
      </Link>
      <CartButton />
    </nav>
  );
}

export default function ShopProduct() {
  const [, params] = useRoute("/shop/:handle");
  const handle = params?.handle;
  const { add, busy } = useCart();

  const { data, isLoading } = useQuery({
    queryKey: ["shop-product", handle],
    queryFn: () =>
      customFetch<{ product: ShopProduct }>(
        `/api/shop/products/${encodeURIComponent(handle!)}`,
        { responseType: "json" },
      ),
    enabled: !!handle,
  });
  const product = data?.product;

  const variants = product?.variants.nodes ?? [];
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const selected =
    variants.find((v) => v.id === variantId) ?? variants[0] ?? null;

  const [gallery, setGallery] = useState(0);
  const images = product?.images.nodes ?? [];
  const hero = images[gallery] ?? product?.featuredImage ?? null;

  return (
    <div className="relative min-h-[100dvh] flex flex-col">
      <AmbientField />
      <ShopHeader />

      <main className="flex-1 w-full max-w-[960px] mx-auto px-6 py-8 md:py-14">
        {isLoading ? (
          <p className="font-sans text-sm text-faint-ink">Loading…</p>
        ) : !product ? (
          <p className="font-body text-soft-ink">
            That item isn't on the desk.{" "}
            <Link href="/shop" className="text-accent-sepia hover:text-deep-brown">
              Back to the shop →
            </Link>
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-10">
            {/* gallery */}
            <div>
              <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-border bg-surface/70">
                {hero ? (
                  <img
                    src={hero.url}
                    alt={hero.altText ?? product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-faint-ink font-display text-3xl">
                    Yadegar
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 mt-3">
                  {images.map((img, i) => (
                    <button
                      key={img.url}
                      onClick={() => setGallery(i)}
                      className={
                        "w-16 h-16 rounded-lg overflow-hidden border transition-colors " +
                        (i === gallery ? "border-accent-sepia" : "border-border")
                      }
                    >
                      <img
                        src={img.url}
                        alt={img.altText ?? ""}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* details */}
            <div>
              <h1 className="font-display text-3xl md:text-4xl text-deep-brown leading-tight">
                {product.title}
              </h1>
              <p className="font-body text-xl text-ink mt-2">
                {formatMoney(selected?.price ?? product.priceRange.minVariantPrice)}
              </p>

              {product.description && (
                <p className="font-body text-soft-ink leading-relaxed mt-5 whitespace-pre-line">
                  {product.description}
                </p>
              )}

              {/* variants */}
              {variants.length > 1 && (
                <div className="mt-6">
                  <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-2">
                    Choose
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v) => {
                      const active = (selected?.id ?? "") === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setVariantId(v.id)}
                          disabled={!v.availableForSale}
                          className={
                            "font-sans text-sm rounded-full px-4 py-1.5 border transition-colors disabled:opacity-40 " +
                            (active
                              ? "border-accent-sepia text-ink"
                              : "border-border text-soft-ink hover:text-ink")
                          }
                        >
                          {v.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* quantity + add */}
              <div className="flex items-center gap-4 mt-7">
                <div className="inline-flex items-center border border-border rounded-full">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="px-3 py-2 text-soft-ink hover:text-ink"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="px-2 font-sans text-sm text-ink tabular-nums">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty((q) => q + 1)}
                    className="px-3 py-2 text-soft-ink hover:text-ink"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => selected && add(selected.id, qty)}
                  disabled={busy || !selected || !selected.availableForSale}
                  className="flex-1 rounded-full bg-deep-brown text-background py-3 font-sans text-sm hover:bg-ink transition-colors disabled:opacity-50"
                  data-testid="add-to-cart"
                >
                  {!selected?.availableForSale
                    ? "Sold out"
                    : busy
                      ? "Adding…"
                      : "Add to cart"}
                </button>
              </div>

              {/* the curation note: why it's on the desk */}
              <p className="font-body text-sm text-faint-ink leading-relaxed mt-6 border-t border-border/60 pt-5">
                Part of the Yadegar desk: the physical companion to your journal.
                Write by hand here, then bring the pages into Yadegar to find what
                keeps returning.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
