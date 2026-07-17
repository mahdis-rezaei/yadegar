import { Fragment, type ReactNode } from "react";
import { Linking, View } from "react-native";
import { Text } from "./text";

// A small Markdown renderer for the FAQ/Help content (headings, bold/italic,
// lists, blockquotes, rules, links). Not a full CommonMark engine — just enough
// for our docs, native and dependency-free.

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).map((p, i) => {
    if (!p) return null;
    const k = `${key}.${i}`;
    if (p.startsWith("**") && p.endsWith("**")) {
      return <Text key={k} style={{ fontWeight: "600" }}>{p.slice(2, -2)}</Text>;
    }
    if (p.startsWith("*") && p.endsWith("*")) {
      return <Text key={k} style={{ fontStyle: "italic" }}>{p.slice(1, -1)}</Text>;
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return <Text key={k} className="text-ink">{p.slice(1, -1)}</Text>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p);
    if (link) {
      const [, label, url] = link;
      if (/^https?:/.test(url)) {
        return (
          <Text key={k} className="text-accent-sepia" onPress={() => void Linking.openURL(url)}>
            {label}
          </Text>
        );
      }
      return <Fragment key={k}>{label}</Fragment>; // in-page anchor → plain text
    }
    return <Fragment key={k}>{p}</Fragment>;
  });
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = (key: string) => {
    if (para.length === 0) return;
    const text = para.join(" ");
    para = [];
    out.push(
      <Text key={`p${key}`} className="text-soft-ink leading-relaxed mb-3" style={{ fontSize: 15 }}>
        {renderInline(text, `p${key}`)}
      </Text>,
    );
  };

  while (i < lines.length) {
    const line = lines[i];
    const key = String(i);

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushPara(key);
      out.push(<View key={`hr${key}`} className="h-px bg-border/60 my-6" />);
      i++;
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^###\s+(.*)$/.exec(line))) {
      flushPara(key);
      out.push(<Text key={`h3${key}`} className="text-lg text-ink mt-6 mb-1.5">{renderInline(m[1], key)}</Text>);
      i++;
      continue;
    }
    if ((m = /^##\s+(.*)$/.exec(line))) {
      flushPara(key);
      out.push(<Text key={`h2${key}`} className="text-2xl text-deep-brown mt-10 mb-2">{renderInline(m[1], key)}</Text>);
      i++;
      continue;
    }
    if ((m = /^#\s+(.*)$/.exec(line))) {
      flushPara(key);
      out.push(<Text key={`h1${key}`} className="text-3xl text-deep-brown mt-4 mb-3">{renderInline(m[1], key)}</Text>);
      i++;
      continue;
    }
    if (/^>\s+/.test(line)) {
      flushPara(key);
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(
        <View key={`bq${key}`} className="border-l-2 border-accent-sepia/40 pl-4 my-3">
          <Text className="text-soft-ink italic leading-relaxed" style={{ fontSize: 15 }}>
            {renderInline(quote.join(" "), key)}
          </Text>
        </View>,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      flushPara(key);
      const items: { text: string; n: string }[] = [];
      let n = 1;
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        const ordered = /^\s*\d+\.\s+/.test(lines[i]);
        const t = lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, "");
        items.push({ text: t, n: ordered ? `${n++}.` : "•" });
        i++;
      }
      out.push(
        <View key={`ul${key}`} className="mb-3 gap-1.5">
          {items.map((it, j) => (
            <View key={j} className="flex-row gap-2">
              <Text className="text-faint-ink" style={{ fontSize: 15, width: 26 }}>{it.n}</Text>
              <Text className="flex-1 text-soft-ink leading-relaxed" style={{ fontSize: 15 }}>
                {renderInline(it.text, `${key}.${j}`)}
              </Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }
    if (line.trim() === "") {
      flushPara(key);
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flushPara("end");

  return <View>{out}</View>;
}
