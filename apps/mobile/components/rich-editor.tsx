import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { TextInput, View } from "react-native";
import { Text } from "./text";
import { htmlToPlain, plainToHtml } from "../lib/html";

// react-native-webview is a NATIVE module. Require it guardedly so a build that
// doesn't include it yet falls back to a plain editor instead of crashing the
// whole Today screen — a static `import` throws at load ("RNCWebViewModule could
// not be found") and takes the app down with it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let WebView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require("react-native-webview").WebView;
} catch {
  WebView = null;
}

// A true WYSIWYG rich editor — a contentEditable surface inside a WebView, so it
// can show LIVE bold/italic/underline/headings/lists/quote/color while typing
// (which React Native's TextInput cannot). The toolbar lives inside the WebView
// and preserves the selection on tap (mousedown preventDefault), so formatting
// never blurs the editor or flickers the keyboard.
//
// Output is HTML restricted to the server's allowlist (we set styleWithCSS so
// color becomes <span style="color">, not <font>); the server sanitizes it again
// into `bodyRich` and derives the canonical plain `body`. On read it renders via
// components/rich-text.tsx (and identically on the web).

export type RichEditorHandle = {
  focus: () => void;
  insertText: (t: string) => void;
  setHtml: (html: string) => void;
};

// The muted palette offered for inline color (any hex is allowed server-side;
// these just keep mobile on-brand). The first resets to the default ink.
const SWATCHES = ["#3A2F25", "#9B6A6A", "#8A6F4D", "#6F7D5A", "#5A6F8A"];

function buildHtml(placeholder: string): string {
  const swatches = SWATCHES.map(
    (c, i) =>
      `<span class="sw${i === 0 ? " reset" : ""}" style="background:${i === 0 ? "transparent" : c}" onmousedown="md(event)" onclick="run('color','${c}')">${i === 0 ? "A" : ""}</span>`,
  ).join("");

  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;padding:0;background:transparent;-webkit-text-size-adjust:100%;}
  *{-webkit-tap-highlight-color:transparent;}
  #bar{position:sticky;top:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;
       padding:8px 12px;background:#FBF8F1;border-bottom:1px solid #E7DECF;z-index:9;}
  #bar button{appearance:none;border:1px solid #E0D6C4;background:#fff;border-radius:8px;
       height:32px;min-width:34px;padding:0 9px;font-size:15px;color:#5b4f40;line-height:1;}
  #bar button:active{background:#F1E9DA;}
  .sep{width:1px;height:22px;background:#E7DECF;margin:0 2px;}
  .sw{width:22px;height:22px;border-radius:11px;border:1px solid #D8CDBA;display:inline-block;}
  .sw.reset{display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:#5b4f40;background:#fff;}
  #bar button.done{margin-left:auto;min-width:0;padding:0 12px;background:#3A2F25;border-color:#3A2F25;color:#F7F1E6;font-weight:600;}
  #editor{padding:16px 16px 48px;outline:none;font-family:Georgia,'Times New Roman',serif;
       font-size:18px;line-height:1.6;color:#3A2F25;min-height:240px;}
  #editor:empty:before{content:attr(data-ph);color:#A59B8D;}
  #editor h2{font-size:25px;line-height:1.25;font-weight:600;color:#4A3B2A;margin:.5em 0 .35em;}
  #editor h3{font-size:20px;line-height:1.3;font-weight:600;color:#4A3B2A;margin:.4em 0 .3em;}
  #editor p{margin:0 0 .65em;}
  #editor blockquote{border-left:3px solid #CBBBA0;margin:.4em 0;padding-left:14px;color:#6b5d4d;font-style:italic;}
  #editor ul,#editor ol{padding-left:24px;margin:.35em 0;}
  #editor li{margin:.15em 0;}
</style></head><body>
<div id="bar">
  <button onmousedown="md(event)" onclick="run('bold')"><b>B</b></button>
  <button onmousedown="md(event)" onclick="run('italic')"><i>I</i></button>
  <button onmousedown="md(event)" onclick="run('underline')"><u>U</u></button>
  <span class="sep"></span>
  <button onmousedown="md(event)" onclick="run('h2')">H</button>
  <button onmousedown="md(event)" onclick="run('h3')">H&#8323;</button>
  <span class="sep"></span>
  <button onmousedown="md(event)" onclick="run('ul')">&#8226;</button>
  <button onmousedown="md(event)" onclick="run('ol')">1.</button>
  <button onmousedown="md(event)" onclick="run('quote')">&#10077;</button>
  <span class="sep"></span>
  ${swatches}
  <button class="done" onclick="done()">Done</button>
</div>
<div id="editor" contenteditable="true" data-ph="${placeholder.replace(/"/g, "&quot;")}"></div>
<script>
  var ed = document.getElementById('editor');
  try { document.execCommand('styleWithCSS', false, true); } catch(e) {}
  function post(type, payload){ window.ReactNativeWebView.postMessage(JSON.stringify({type:type,payload:payload})); }
  function emit(){ post('change', ed.innerHTML); }
  var savedRange = null;
  document.addEventListener('selectionchange', function(){
    var s = window.getSelection();
    if (s && s.rangeCount && ed.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
  });
  function md(e){ e.preventDefault(); }          // keep selection/keyboard on toolbar tap
  function done(){ ed.blur(); if (document.activeElement) document.activeElement.blur(); }
  function restore(){
    if (!savedRange) return;
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange);
  }
  function exec(cmd, val){ ed.focus(); restore(); document.execCommand(cmd, false, val || null); emit(); }
  function run(action, val){
    if (action==='bold') exec('bold');
    else if (action==='italic') exec('italic');
    else if (action==='underline') exec('underline');
    else if (action==='h2') exec('formatBlock','H2');
    else if (action==='h3') exec('formatBlock','H3');
    else if (action==='ul') exec('insertUnorderedList');
    else if (action==='ol') exec('insertOrderedList');
    else if (action==='quote') exec('formatBlock','BLOCKQUOTE');
    else if (action==='color') exec('foreColor', val);
  }
  ed.addEventListener('input', emit);
  ed.addEventListener('blur', emit);
  // Commands from React Native arrive here.
  window.__rn = function(json){
    var m = JSON.parse(json);
    if (m.action==='setHtml'){ ed.innerHTML = m.value || ''; emit(); }
    else if (m.action==='insert'){ ed.focus(); restore(); document.execCommand('insertText', false, m.value); emit(); }
    else if (m.action==='focus'){ ed.focus(); }
  };
  post('ready', '');
</script></body></html>`;
}

type RichEditorProps = {
  initialHtml?: string;
  placeholder?: string;
  onChangeHtml: (html: string) => void;
  height?: number;
};

const RichEditorWeb = forwardRef<RichEditorHandle, RichEditorProps>(function RichEditorWeb(
  { initialHtml = "", placeholder = "Start with one sentence…", onChangeHtml, height = 420 },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildHtml(placeholder), [placeholder]);
  const initialRef = useRef(initialHtml);
  const [ready, setReady] = useState(false);

  function send(action: string, value?: string) {
    const msg = JSON.stringify({ action, value });
    webRef.current?.injectJavaScript(`window.__rn(${JSON.stringify(msg)});true;`);
  }

  useImperativeHandle(ref, () => ({
    focus: () => send("focus"),
    insertText: (t: string) => send("insert", t),
    setHtml: (h: string) => send("setHtml", h),
  }));

  return (
    <View style={{ height }}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        style={{ backgroundColor: "transparent", flex: 1 }}
        keyboardDisplayRequiresUserAction={false}
        scrollEnabled
        onMessage={(e) => {
          let data: { type?: string; payload?: string } = {};
          try {
            data = JSON.parse(e.nativeEvent.data);
          } catch {
            return;
          }
          if (data.type === "ready") {
            setReady(true);
            if (initialRef.current) send("setHtml", initialRef.current);
          } else if (data.type === "change") {
            onChangeHtml(data.payload ?? "");
          }
        }}
      />
    </View>
  );
});

// Fallback for a build without the WebView module: a plain-text editor that
// keeps writing working. It speaks the same HTML contract — loading via
// htmlToPlain, reporting changes as plainToHtml — so saving/drafts are
// unchanged; you just don't get live styling until the app is rebuilt.
const RichEditorPlain = forwardRef<RichEditorHandle, RichEditorProps>(function RichEditorPlain(
  { initialHtml = "", placeholder = "Start with one sentence…", onChangeHtml },
  ref,
) {
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState(() => htmlToPlain(initialHtml));

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    insertText: (t: string) =>
      setText((prev) => {
        const next = prev + (prev && !prev.endsWith(" ") ? " " : "") + t;
        onChangeHtml(plainToHtml(next));
        return next;
      }),
    // Load-only (day change): update the field without echoing a change back.
    setHtml: (h: string) => setText(htmlToPlain(h)),
  }));

  return (
    <View className="px-3 py-2">
      <Text className="text-faint-ink text-xs mb-2">
        Writing in plain text — formatting turns on after the next app build.
      </Text>
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={(t) => {
          setText(t);
          onChangeHtml(plainToHtml(t));
        }}
        multiline
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor="#A59B8D"
        className="min-h-72 text-lg leading-7 text-ink"
        autoCorrect
        scrollEnabled={false}
      />
    </View>
  );
});

// Pick the editor once, by whether the native module is in this binary.
export const RichEditor = WebView ? RichEditorWeb : RichEditorPlain;
