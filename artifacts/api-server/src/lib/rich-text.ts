import sanitizeHtml from "sanitize-html";

// The server is the trust boundary for rich entry text. The client composes HTML
// in a contentEditable editor, but we never store or re-serve it raw: we run it
// through an allowlist here so stored `bodyRich` is always safe to render, and
// we DERIVE the canonical plain-text `body` from the sanitized HTML so the
// memory engine, resurfacing excerpts, and exports only ever see clean prose.

// The literary formatting set: emphasis, two heading levels, lists, blockquote,
// and inline text color (muted palette, enforced by the client). Everything else
// — scripts, images, links, iframes, event handlers — is discarded.
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "span",
];

// Inline color only — and only as a hex or rgb() value. No other CSS survives,
// so there's no foothold for url()/expression()/position tricks.
const COLOR_VALUES = [
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
  /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
];

export function sanitizeRich(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { "*": ["style"] },
    allowedStyles: { "*": { color: COLOR_VALUES } },
    // Drop disallowed tags entirely but keep their text content.
    disallowedTagsMode: "discard",
    allowedSchemes: [],
  });
}

const NBSP = " ";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    );
}

// Flatten sanitized HTML to plain text the way a reader would see it: block
// boundaries and <br> become newlines, all other tags vanish. This is what the
// engine reads, so it must be clean prose (no markup, no bullet glyphs).
export function richToPlainText(html: string): string {
  let s = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s).split(NBSP).join(" ");
  return s
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
