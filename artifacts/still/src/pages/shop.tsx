import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { AmbientField } from "@/components/site-chrome";
import { CartButton } from "@/components/cart-drawer";
import { formatMoney, type ShopProduct } from "@/lib/use-cart";

// The shop's product list (PLP). Public + headless: products come from Shopify's
// Storefront API via /api/shop. Gated on /shop/config so it reads "coming soon"
// until the store is wired, never an error.
function ShopHeader() {
  return (
    <nav className="w-full flex items-center justify-between px-6 md:px-10 py-5">
      <Link
        href="/"
        className="font-display text-xl text-deep-brown tracking-tight"
      >
        Yadegar
      </Link>
      <div className="flex items-center gap-5">
        <Link
          href="/pricing"
          className="font-sans text-xs uppercase tracking-[0.18em] text-soft-ink hover:text-ink transition-colors"
        >
          Pricing
        </Link>
        <CartButton />
      </div>
    </nav>
  );
}

export default function Shop() {
  const config = useQuery({
    queryKey: ["shop-config"],
    queryFn: () =>
      customFetch<{ enabled?: boolean }>("/api/shop/config", {
        responseType: "json",
      }),
    staleTime: 5 * 60 * 1000,
  });
  const enabled = config.data?.enabled === true;

  const products = useQuery({
    queryKey: ["shop-products"],
    queryFn: () =>
      customFetch<{ products: ShopProduct[] }>("/api/shop/products", {
        responseType: "json",
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  const items = products.data?.products ?? [];

  return (
    <div className="relative min-h-[100dvh] flex flex-col">
      <AmbientField />
      <ShopHeader />

      <main className="flex-1 w-full max-w-[960px] mx-auto px-6 py-10 md:py-16">
        <p className="font-sans text-xs uppercase tracking-[0.22em] text-faint-ink text-center mb-6">
          The desk
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-deep-brown text-center leading-tight mb-3">
          The tools that remain
        </h1>
        <p className="font-body text-soft-ink text-center leading-relaxed mb-12 max-w-[34rem] mx-auto">
          A small, considered set for a lifelong practice: the Yadegar journal and
          the few things that sit beside it. Write by hand, then bring the pages
          into Yadegar.
        </p>

        {config.isLoading ? null : !enabled ? (
          <p className="font-body text-soft-ink text-center">
            The shop is opening soon.
          </p>
        ) : products.isLoading ? (
          <p className="font-sans text-sm text-faint-ink text-center">Loading…</p>
        ) : items.length === 0 ? (
          <p className="font-body text-soft-ink text-center">
            New things are on their way to the desk.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {items.map((p) => (
              <Link
                key={p.id}
                href={`/shop/${p.handle}`}
                className="group block"
                data-testid={`product-${p.handle}`}
              >
                <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-border bg-surface/70 mb-3">
                  {p.featuredImage ? (
                    <img
                      src={p.featuredImage.url}
                      alt={p.featuredImage.altText ?? p.title}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-faint-ink font-display text-2xl">
                      Yadegar
                    </div>
                  )}
                </div>
                <p className="font-body text-lg text-ink leading-snug">
                  {p.title}
                </p>
                <p className="font-sans text-sm text-soft-ink mt-0.5">
                  {formatMoney(p.priceRange.minVariantPrice)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
