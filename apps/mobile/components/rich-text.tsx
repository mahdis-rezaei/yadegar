import { Fragment, useMemo, type ReactNode } from "react";
import { View } from "react-native";
import { Text } from "./text";

// Renders the server-sanitized rich entry HTML (`bodyRich`) natively. The tag set
// is a fixed allowlist the API enforces (see api-server/src/lib/rich-text.ts):
//   p, br, strong/b, em/i, u, h2, h3, ul, ol, li, blockquote, span[color]
// Because that set is small and always well-formed, we parse it into <Text>/<View>
// ourselves rather than pulling in a WebView or a heavy HTML library — keeping the
// reader native, fast, and on-theme (and avoiding another native build).

type Node =
  | { type: "text"; text: string }
  | { type: "el"; tag: string; attrs: string; children: Node[] };

const VOID_TAGS = new Set(["br"]);
const INLINE_TAGS = new Set(["strong", "b", "em", "i", "u", "span", "br"]);

const NAMED_ENTITIES: Record<string, string> = {
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
    .replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, (m) => NAMED_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    );
}

// Tokenize the (sanitized, well-formed) HTML into a small DOM-like tree.
function parse(html: string): Node[] {
  const tokenRe = /<\/?([a-zA-Z0-9]+)([^>]*)>/g;
  const root: Node = { type: "el", tag: "#root", attrs: "", children: [] };
  const stack: Node[] = [root];
  const push = (n: Node) => {
    const top = stack[stack.length - 1];
    if (top.type === "el") top.children.push(n);
  };

  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(html))) {
    if (m.index > last) {
      const text = decodeEntities(html.slice(last, m.index));
      if (text) push({ type: "text", text });
    }
    last = tokenRe.lastIndex;

    const closing = m[0][1] === "/";
    const tag = m[1].toLowerCase();
    if (closing) {
      // Pop back to (and past) the matching open tag.
      for (let i = stack.length - 1; i > 0; i--) {
        const node = stack[i];
        if (node.type === "el" && node.tag === tag) {
          stack.length = i;
          break;
        }
      }
    } else if (VOID_TAGS.has(tag) || m[2].trim().endsWith("/")) {
      push({ type: "el", tag, attrs: m[2], children: [] });
    } else {
      const el: Node = { type: "el", tag, attrs: m[2], children: [] };
      push(el);
      stack.push(el);
    }
  }
  if (last < html.length) {
    const text = decodeEntities(html.slice(last));
    if (text) push({ type: "text", text });
  }
  return root.children;
}

type Inline = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
};

// Inline color only (the allowlist permits a muted `color:` and nothing else).
function colorFromAttrs(attrs: string): string | undefined {
  const m = /color:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]*\))/i.exec(attrs);
  return m ? m[1] : undefined;
}

function inlineToStyle(s: Inline) {
  return {
    ...(s.bold ? { fontWeight: "600" as const } : {}),
    ...(s.italic ? { fontStyle: "italic" as const } : {}),
    ...(s.underline ? { textDecorationLine: "underline" as const } : {}),
    ...(s.color ? { color: s.color } : {}),
  };
}

function renderInline(nodes: Node[], style: Inline, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  nodes.forEach((n, i) => {
    const key = `${keyPrefix}.${i}`;
    if (n.type === "text") {
      out.push(<Fragment key={key}>{n.text}</Fragment>);
      return;
    }
    if (n.tag === "br") {
      out.push(<Fragment key={key}>{"\n"}</Fragment>);
      return;
    }
    const next: Inline = { ...style };
    if (n.tag === "strong" || n.tag === "b") next.bold = true;
    if (n.tag === "em" || n.tag === "i") next.italic = true;
    if (n.tag === "u") next.underline = true;
    if (n.tag === "span") {
      const c = colorFromAttrs(n.attrs);
      if (c) next.color = c;
    }
    out.push(
      <Text key={key} style={inlineToStyle(next)}>
        {renderInline(n.children, next, key)}
      </Text>,
    );
  });
  return out;
}

// Walk the top-level (block) nodes. Loose inline/text runs are gathered into a
// paragraph so stray text never gets dropped. `quoted` styles paragraphs inside
// a blockquote (muted + italic) to match the web.
function renderBlocks(nodes: Node[], keyPrefix: string, quoted = false): ReactNode[] {
  const out: ReactNode[] = [];
  let run: Node[] = [];
  const paraClass = quoted
    ? "text-base leading-7 text-soft-ink"
    : "text-lg leading-7 text-ink";
  const paraStyle = quoted
    ? { marginBottom: 8, fontStyle: "italic" as const }
    : { marginBottom: 12 };

  const flush = (k: string) => {
    if (run.length === 0) return;
    const items = run;
    run = [];
    if (items.every((n) => n.type === "text" && !n.text.trim())) return;
    out.push(
      <Text key={`p${k}`} className={paraClass} style={paraStyle}>
        {renderInline(items, {}, `p${k}`)}
      </Text>,
    );
  };

  nodes.forEach((n, i) => {
    const key = `${keyPrefix}.${i}`;
    if (n.type === "text") {
      run.push(n);
      return;
    }
    if (INLINE_TAGS.has(n.tag)) {
      run.push(n);
      return;
    }
    flush(key);
    switch (n.tag) {
      case "h2":
        out.push(
          <Text
            key={key}
            className="text-deep-brown"
            style={{ fontSize: 26, lineHeight: 32, fontWeight: "600", marginTop: 8, marginBottom: 8 }}
          >
            {renderInline(n.children, {}, key)}
          </Text>,
        );
        break;
      case "h3":
        out.push(
          <Text
            key={key}
            className="text-deep-brown"
            style={{ fontSize: 20, lineHeight: 26, fontWeight: "600", marginTop: 6, marginBottom: 6 }}
          >
            {renderInline(n.children, {}, key)}
          </Text>,
        );
        break;
      case "blockquote":
        out.push(
          <View
            key={key}
            style={{ borderLeftWidth: 3, borderLeftColor: "#CBBBA0", paddingLeft: 14, marginVertical: 8 }}
          >
            {renderBlocks(n.children, key, true)}
          </View>,
        );
        break;
      case "ul":
      case "ol": {
        const lis = n.children.filter(
          (c): c is Extract<Node, { type: "el" }> => c.type === "el" && c.tag === "li",
        );
        out.push(
          <View key={key} style={{ marginBottom: 12, gap: 4 }}>
            {lis.map((li, idx) => (
              <View key={`${key}.li${idx}`} style={{ flexDirection: "row" }}>
                <Text className="text-lg leading-7 text-ink" style={{ width: 22 }}>
                  {n.tag === "ol" ? `${idx + 1}.` : "•"}
                </Text>
                <Text className="text-lg leading-7 text-ink" style={{ flex: 1 }}>
                  {renderInline(li.children, {}, `${key}.li${idx}`)}
                </Text>
              </View>
            ))}
          </View>,
        );
        break;
      }
      case "p":
      default:
        out.push(
          <Text key={key} className={paraClass} style={paraStyle}>
            {renderInline(n.children, {}, key)}
          </Text>,
        );
    }
  });
  flush(`${keyPrefix}.end`);
  return out;
}

export function RichText({ html }: { html: string }) {
  const blocks = useMemo(() => renderBlocks(parse(html), "r"), [html]);
  return <View>{blocks}</View>;
}
