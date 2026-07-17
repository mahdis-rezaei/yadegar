// Small helpers to bridge the rich editor (HTML) and the plain-text world. The
// server is the canonical source — it sanitizes bodyRich and derives the real
// plain `body` — so these are only for loading plain pages into the editor and
// for a local "is there any text?" check.

export function plainToHtml(text: string): string {
  if (!text) return "";
  return text
    .split(/\n/)
    .map((line) => {
      const esc = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return esc.trim() === "" ? "<p><br></p>" : `<p>${esc}</p>`;
    })
    .join("");
}

export function htmlToPlain(html: string): string {
  if (!html) return "";
  let s = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}
