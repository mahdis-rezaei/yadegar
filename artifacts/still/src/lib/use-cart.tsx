import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { customFetch } from "@workspace/api-client-react";

// Headless cart, backed by Shopify's Cart API (via our /api/shop proxy). The cart
// id is persisted in localStorage so it survives reloads; checkout hands off to
// Shopify's hosted checkoutUrl.

export interface Money {
  amount: string;
  currencyCode: string;
}
export interface ShopVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  selectedOptions: { name: string; value: string }[];
}
export interface ShopProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  featuredImage: { url: string; altText: string | null } | null;
  images: { nodes: { url: string; altText: string | null }[] };
  priceRange: { minVariantPrice: Money };
  variants: { nodes: ShopVariant[] };
}
export interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    price: Money;
    product: {
      title: string;
      handle: string;
      featuredImage: { url: string; altText: string | null } | null;
    };
  };
}
export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: Money };
  lines: { nodes: CartLine[] };
}

export function formatMoney(m?: Money | null): string {
  if (!m) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: m.currencyCode || "USD",
    }).format(Number(m.amount));
  } catch {
    return `$${m.amount}`;
  }
}

const STORAGE_KEY = "yadegar:cartId";

interface CartState {
  cart: Cart | null;
  busy: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (merchandiseId: string, quantity?: number) => Promise<void>;
  updateLine: (lineId: string, quantity: number) => Promise<void>;
}

const CartContext = createContext<CartState | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // Rehydrate a stored cart on load (if it still exists in Shopify).
  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) return;
    customFetch<{ cart: Cart | null }>(
      `/api/shop/cart/${encodeURIComponent(id)}`,
      { responseType: "json" },
    )
      .then((r) => {
        if (r?.cart) setCart(r.cart);
        else localStorage.removeItem(STORAGE_KEY); // cart expired/cleared
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((c: Cart | null) => {
    setCart(c);
    if (c?.id) localStorage.setItem(STORAGE_KEY, c.id);
  }, []);

  const add = useCallback(
    async (merchandiseId: string, quantity = 1) => {
      setBusy(true);
      try {
        const r = await customFetch<{ cart: Cart | null }>("/api/shop/cart", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cartId: cart?.id, merchandiseId, quantity }),
          responseType: "json",
        });
        if (r?.cart) {
          persist(r.cart);
          setOpen(true);
        }
      } finally {
        setBusy(false);
      }
    },
    [cart?.id, persist],
  );

  const updateLine = useCallback(
    async (lineId: string, quantity: number) => {
      if (!cart?.id) return;
      setBusy(true);
      try {
        const r = await customFetch<{ cart: Cart | null }>(
          `/api/shop/cart/${encodeURIComponent(cart.id)}/lines`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lineId, quantity }),
            responseType: "json",
          },
        );
        if (r?.cart) persist(r.cart);
      } finally {
        setBusy(false);
      }
    },
    [cart?.id, persist],
  );

  return (
    <CartContext.Provider
      value={{ cart, busy, open, setOpen, add, updateLine }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
