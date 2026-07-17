import { Router } from "express";

// Headless commerce for the Yadegar shop. We proxy Shopify's Storefront API
// (GraphQL) through our Node layer rather than calling it from the browser: it
// keeps the token out of the client bundle, centralizes error handling, and lets
// us reshape responses for the UI. Cart is built with the Storefront Cart API and
// checkout hands off to Shopify's hosted checkout (payments, tax, shipping). All
// routes are PUBLIC (browsing/cart need no account) and no-op gracefully (503)
// until SHOPIFY_STORE_DOMAIN + SHOPIFY_STOREFRONT_TOKEN are set.

const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";

function shopEnabled(): boolean {
  return (
    !!process.env.SHOPIFY_STORE_DOMAIN && !!process.env.SHOPIFY_STOREFRONT_TOKEN
  );
}

function endpoint(): string {
  const domain = (process.env.SHOPIFY_STORE_DOMAIN ?? "").replace(
    /^https?:\/\//,
    "",
  );
  return `https://${domain}/api/${API_VERSION}/graphql.json`;
}

// One GraphQL call to the Storefront API. Throws on transport/GraphQL errors so
// each route can answer 502 without leaking internals.
async function storefront<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Shopify-Storefront-Access-Token":
        process.env.SHOPIFY_STOREFRONT_TOKEN ?? "",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Storefront HTTP ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(`Storefront GraphQL error`);
  if (!json.data) throw new Error("Storefront: no data");
  return json.data;
}

// ── GraphQL fragments / queries ──────────────────────────────────────────────

const PRODUCT_FIELDS = `
  id
  handle
  title
  description
  descriptionHtml
  featuredImage { url altText }
  images(first: 8) { nodes { url altText } }
  priceRange { minVariantPrice { amount currencyCode } }
  variants(first: 20) {
    nodes {
      id
      title
      availableForSale
      price { amount currencyCode }
      selectedOptions { name value }
    }
  }
`;

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost { subtotalAmount { amount currencyCode } }
  lines(first: 50) {
    nodes {
      id
      quantity
      merchandise {
        ... on ProductVariant {
          id
          title
          price { amount currencyCode }
          product { title handle featuredImage { url altText } }
        }
      }
    }
  }
`;

const router = Router();

// GET /shop/config — public probe so the client shows the shop only when wired.
router.get("/shop/config", (_req, res): void => {
  res.json({ enabled: shopEnabled() });
});

// GET /shop/products?collection=the-desk — the storefront product list (PLP).
router.get("/shop/products", async (req, res): Promise<void> => {
  if (!shopEnabled()) {
    res.status(503).json({ error: "Shop is not configured yet" });
    return;
  }
  const collection = (req.query as { collection?: string }).collection;
  try {
    if (collection) {
      const data = await storefront<{
        collection: { products: { nodes: unknown[] } } | null;
      }>(
        `query($handle: String!) {
          collection(handle: $handle) {
            products(first: 50) { nodes { ${PRODUCT_FIELDS} } }
          }
        }`,
        { handle: collection },
      );
      res.json({ products: data.collection?.products.nodes ?? [] });
      return;
    }
    const data = await storefront<{ products: { nodes: unknown[] } }>(
      `query { products(first: 50, sortKey: BEST_SELLING) { nodes { ${PRODUCT_FIELDS} } } }`,
    );
    res.json({ products: data.products.nodes });
  } catch (err) {
    req.log.error({ err }, "Shop products fetch failed");
    res.status(502).json({ error: "Could not load products" });
  }
});

// GET /shop/products/:handle — a single product (PDP).
router.get("/shop/products/:handle", async (req, res): Promise<void> => {
  if (!shopEnabled()) {
    res.status(503).json({ error: "Shop is not configured yet" });
    return;
  }
  try {
    const data = await storefront<{ product: unknown | null }>(
      `query($handle: String!) { product(handle: $handle) { ${PRODUCT_FIELDS} } }`,
      { handle: req.params.handle },
    );
    if (!data.product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json({ product: data.product });
  } catch (err) {
    req.log.error({ err }, "Shop product fetch failed");
    res.status(502).json({ error: "Could not load product" });
  }
});

// GET /shop/cart/:id — fetch a cart by id (rehydrate the client's stored cart).
router.get("/shop/cart/:id", async (req, res): Promise<void> => {
  if (!shopEnabled()) {
    res.status(503).json({ error: "Shop is not configured yet" });
    return;
  }
  try {
    const data = await storefront<{ cart: unknown | null }>(
      `query($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`,
      { id: req.params.id },
    );
    res.json({ cart: data.cart });
  } catch (err) {
    req.log.error({ err }, "Shop cart fetch failed");
    res.status(502).json({ error: "Could not load cart" });
  }
});

// POST /shop/cart { cartId?, merchandiseId, quantity } — add a line, creating the
// cart on first add. Returns the cart (incl. checkoutUrl for the hosted checkout).
router.post("/shop/cart", async (req, res): Promise<void> => {
  if (!shopEnabled()) {
    res.status(503).json({ error: "Shop is not configured yet" });
    return;
  }
  const body = (req.body ?? {}) as {
    cartId?: string;
    merchandiseId?: string;
    quantity?: number;
  };
  if (!body.merchandiseId) {
    res.status(400).json({ error: "merchandiseId required" });
    return;
  }
  const quantity = Math.max(1, Math.round(body.quantity ?? 1));
  const lines = [{ merchandiseId: body.merchandiseId, quantity }];

  try {
    if (body.cartId) {
      const data = await storefront<{
        cartLinesAdd: { cart: unknown; userErrors: { message: string }[] };
      }>(
        `mutation($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart { ${CART_FIELDS} }
            userErrors { message }
          }
        }`,
        { cartId: body.cartId, lines },
      );
      res.json({ cart: data.cartLinesAdd.cart });
      return;
    }
    const data = await storefront<{
      cartCreate: { cart: unknown; userErrors: { message: string }[] };
    }>(
      `mutation($lines: [CartLineInput!]!) {
        cartCreate(input: { lines: $lines }) {
          cart { ${CART_FIELDS} }
          userErrors { message }
        }
      }`,
      { lines },
    );
    res.json({ cart: data.cartCreate.cart });
  } catch (err) {
    req.log.error({ err }, "Shop cart add failed");
    res.status(502).json({ error: "Could not update cart" });
  }
});

// POST /shop/cart/:id/lines { lineId, quantity } — change a line's quantity, or
// remove it when quantity is 0.
router.post("/shop/cart/:id/lines", async (req, res): Promise<void> => {
  if (!shopEnabled()) {
    res.status(503).json({ error: "Shop is not configured yet" });
    return;
  }
  const body = (req.body ?? {}) as { lineId?: string; quantity?: number };
  if (!body.lineId) {
    res.status(400).json({ error: "lineId required" });
    return;
  }
  const quantity = Math.max(0, Math.round(body.quantity ?? 0));
  try {
    if (quantity === 0) {
      const data = await storefront<{ cartLinesRemove: { cart: unknown } }>(
        `mutation($cartId: ID!, $lineIds: [ID!]!) {
          cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
            cart { ${CART_FIELDS} }
          }
        }`,
        { cartId: req.params.id, lineIds: [body.lineId] },
      );
      res.json({ cart: data.cartLinesRemove.cart });
      return;
    }
    const data = await storefront<{ cartLinesUpdate: { cart: unknown } }>(
      `mutation($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart { ${CART_FIELDS} }
        }
      }`,
      {
        cartId: req.params.id,
        lines: [{ id: body.lineId, quantity }],
      },
    );
    res.json({ cart: data.cartLinesUpdate.cart });
  } catch (err) {
    req.log.error({ err }, "Shop cart line update failed");
    res.status(502).json({ error: "Could not update cart" });
  }
});

export default router;
