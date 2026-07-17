import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  createRecognition,
  speechSupported,
  type SpeechRecognitionLike,
} from "@/lib/speech-recognition";

// A deliberately minimal contentEditable composer for the literary formatting
// set, emphasis, two heading levels, lists, blockquote, and a few muted text
// colors. No editor library: the toolbar drives document.execCommand and we emit
// the raw HTML up to the parent, which sends it to the server. The SERVER is the
// trust boundary (it sanitizes and derives the plain-text body the engine
// reads), so this component only has to produce HTML and stay calm and quiet.

// Muted, on-brand swatches only, no loud colors (per the product's design
// ethos). Values are desaturated earth tones that sit on warm paper.
const SWATCHES: { name: string; value: string }[] = [
  { name: "Ink", value: "#25211C" },
  { name: "Sepia", value: "#8A6F4D" },
  { name: "Clay", value: "#9A5B43" },
  { name: "Moss", value: "#6E6A3E" },
  { name: "Slate", value: "#5B6675" },
  { name: "Plum", value: "#6E5366" },
];

export interface RichEditorHandle {
  clear: () => void;
}

interface Props {
  initialHTML?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (html: string, text: string) => void;
  className?: string;
  ariaLabel?: string;
  "data-testid"?: string;
}

function ToolbarButton({
  label,
  title,
  onActivate,
  className = "",
}: {
  label: React.ReactNode;
  title: string;
  onActivate: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      // mousedown-preventDefault keeps the editor's selection while the button
      // is clicked (otherwise the selection collapses and the command no-ops).
      onMouseDown={(e) => {
        e.preventDefault();
        onActivate();
      }}
      className={
        "h-7 min-w-7 px-1.5 rounded-md text-soft-ink hover:text-ink hover:bg-border/40 transition-colors text-sm leading-none flex items-center justify-center " +
        className
      }
    >
      {label}
    </button>
  );
}

export const RichEditor = forwardRef<RichEditorHandle, Props>(
  function RichEditor(
    {
      initialHTML = "",
      placeholder,
      autoFocus,
      onChange,
      className = "",
      ariaLabel,
      "data-testid": testId,
    },
    ref,
  ) {
    const elRef = useRef<HTMLDivElement>(null);
    const [empty, setEmpty] = useState(!initialHTML);

    // --- Dictation (Web Speech API) -------------------------------------
    const [supported] = useState(() => speechSupported());
    const [listening, setListening] = useState(false);
    const [interim, setInterim] = useState("");
    const [dictError, setDictError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    // Web Speech stops on its own after a pause; this flag means "the user still
    // wants to dictate," so onend restarts it until they explicitly stop.
    const wantListenRef = useRef(false);

    // Seed once on mount. Never write innerHTML from React again, that would
    // reset the caret on every keystroke.
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      el.innerHTML = initialHTML;
      setEmpty(!el.innerText.trim());
      if (autoFocus) el.focus();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      clear() {
        const el = elRef.current;
        if (!el) return;
        if (wantListenRef.current) stopDictation();
        el.innerHTML = "";
        setEmpty(true);
        onChange("", "");
      },
    }));

    function emit() {
      const el = elRef.current;
      if (!el) return;
      const text = el.innerText;
      setEmpty(!text.trim());
      onChange(el.innerHTML, text);
    }

    function exec(command: string, value?: string) {
      const el = elRef.current;
      if (!el) return;
      el.focus();
      try {
        document.execCommand("styleWithCSS", false, "true");
      } catch {
        // Older engines may not support styleWithCSS, color still works.
      }
      document.execCommand(command, false, value);
      emit();
    }

    // Toggle a block format (heading/quote) off by returning it to a paragraph.
    function block(tag: string) {
      let current = "";
      try {
        current = (document.queryCommandValue("formatBlock") || "").toLowerCase();
      } catch {
        // ignore, fall through to setting the tag
      }
      exec("formatBlock", current === tag.toLowerCase() ? "P" : tag);
    }

    function placeCaretAtEnd() {
      const el = elRef.current;
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    // Drop a finalized transcript chunk in at the caret. If focus has wandered
    // out of the editor, append at the end instead.
    function insertTranscript(text: string) {
      const el = elRef.current;
      if (!el || !text) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode || !el.contains(sel.anchorNode)) {
        placeCaretAtEnd();
      }
      const existing = el.innerText;
      const needsSpace = existing.length > 0 && !/\s$/.test(existing);
      document.execCommand("insertText", false, (needsSpace ? " " : "") + text);
      emit();
    }

    function stopDictation() {
      wantListenRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // already stopped
      }
      setListening(false);
      setInterim("");
    }

    function startDictation() {
      const rec = createRecognition();
      if (!rec) return;
      setDictError(null);
      rec.lang = navigator.language || "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const chunk = result[0]?.transcript ?? "";
          if (result.isFinal) finalText += chunk;
          else interimText += chunk;
        }
        if (finalText) insertTranscript(finalText.trim());
        setInterim(interimText);
      };
      rec.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setDictError("Microphone access is blocked. Allow it to dictate.");
        } else if (event.error !== "aborted" && event.error !== "no-speech") {
          setDictError("Dictation stopped unexpectedly.");
        }
        wantListenRef.current = false;
        setListening(false);
        setInterim("");
      };
      rec.onend = () => {
        // Continuous mode still ends on long pauses; restart while the user
        // hasn't stopped, otherwise settle.
        if (wantListenRef.current) {
          try {
            rec.start();
          } catch {
            // start can race the end event; ignore.
          }
        } else {
          setListening(false);
          setInterim("");
        }
      };
      recognitionRef.current = rec;
      wantListenRef.current = true;
      setListening(true);
      elRef.current?.focus();
      placeCaretAtEnd();
      try {
        rec.start();
      } catch {
        // ignore double-start
      }
    }

    // Tear down recognition if the editor unmounts mid-dictation.
    useEffect(() => {
      return () => {
        wantListenRef.current = false;
        try {
          recognitionRef.current?.abort();
        } catch {
          // ignore
        }
      };
    }, []);

    return (
      <div className={className}>
        <div
          className="flex flex-nowrap overflow-x-auto md:flex-wrap md:overflow-visible items-center gap-0.5 pb-2 mb-3 border-b border-border/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0"
          role="toolbar"
          aria-label="Text formatting"
        >
          <ToolbarButton
            label={<span className="font-semibold">B</span>}
            title="Bold"
            onActivate={() => exec("bold")}
          />
          <ToolbarButton
            label={<span className="italic font-serif">I</span>}
            title="Italic"
            onActivate={() => exec("italic")}
          />
          <span className="w-px h-4 bg-border mx-1" aria-hidden />
          <ToolbarButton
            label="H"
            title="Heading"
            onActivate={() => block("H2")}
          />
          <ToolbarButton
            label={<span className="text-xs">H</span>}
            title="Subheading"
            onActivate={() => block("H3")}
          />
          <span className="w-px h-4 bg-border mx-1" aria-hidden />
          <ToolbarButton
            label="•"
            title="Bulleted list"
            onActivate={() => exec("insertUnorderedList")}
          />
          <ToolbarButton
            label="1."
            title="Numbered list"
            onActivate={() => exec("insertOrderedList")}
          />
          <ToolbarButton
            label="❝"
            title="Quote"
            onActivate={() => block("BLOCKQUOTE")}
          />
          <span className="w-px h-4 bg-border mx-1" aria-hidden />
          <div className="flex items-center gap-1 px-0.5">
            {SWATCHES.map((s) => (
              <button
                key={s.value}
                type="button"
                title={s.name}
                aria-label={`Color: ${s.name}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  exec("foreColor", s.value);
                }}
                className="w-4 h-4 rounded-full border border-border/70 hover:scale-110 transition-transform"
                style={{ backgroundColor: s.value }}
                data-testid={`button-color-${s.name.toLowerCase()}`}
              />
            ))}
          </div>
          <span className="w-px h-4 bg-border mx-1" aria-hidden />
          <ToolbarButton
            label={<span className="text-xs tracking-tight">⤬</span>}
            title="Clear formatting"
            onActivate={() => exec("removeFormat")}
          />
          {supported && (
            <>
              <span className="w-px h-4 bg-border mx-1" aria-hidden />
              <button
                type="button"
                title={
                  listening
                    ? "Stop dictation"
                    : "Dictate (speech is handled by your browser)"
                }
                aria-label={listening ? "Stop dictation" : "Start dictation"}
                aria-pressed={listening}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (listening) stopDictation();
                  else startDictation();
                }}
                className={
                  "h-7 min-w-7 px-1.5 rounded-md transition-colors text-sm leading-none flex items-center gap-1 " +
                  (listening
                    ? "text-accent-sepia bg-accent-sepia/10"
                    : "text-soft-ink hover:text-ink hover:bg-border/40")
                }
                data-testid="button-dictate"
              >
                <span className={listening ? "animate-pulse" : ""}>🎙</span>
                {listening && (
                  <span className="font-sans text-xs">Listening…</span>
                )}
              </button>
            </>
          )}
        </div>

        <div
          ref={elRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          data-placeholder={placeholder}
          data-empty={empty}
          data-testid={testId}
          onInput={emit}
          className="rich-content rich-editor flex-1 w-full bg-transparent focus:outline-none"
        />

        {listening && (
          <div className="mt-2" data-testid="dictation-status">
            {interim && (
              <p className="font-body text-soft-ink/80 italic leading-relaxed">
                {interim}
              </p>
            )}
            <p className="font-sans text-xs text-faint-ink mt-1">
              Speak and your words appear above. Dictation is handled by your
              browser's speech service, Yadegar doesn't record the audio.
            </p>
          </div>
        )}
        {dictError && (
          <p className="font-sans text-xs text-faint-ink mt-2">{dictError}</p>
        )}
      </div>
    );
  },
);
