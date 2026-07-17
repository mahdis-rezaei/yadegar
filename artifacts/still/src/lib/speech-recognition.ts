// Minimal typed shim over the Web Speech API (SpeechRecognition). It isn't in
// TypeScript's DOM lib, and support is uneven (Chrome/Edge/Safari yes via the
// webkit prefix; Firefox no), so we feature-detect and degrade gracefully, // callers hide the mic entirely when this returns null/false.
//
// Privacy note (surfaced in the UI): recognition is performed by the browser's
// own speech service, on Chrome that means Google's servers, on Safari/iOS
// Apple's. We never record or store the audio ourselves; only the transcript
// text lands in the entry.

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function speechSupported(): boolean {
  return getCtor() !== undefined;
}

export function createRecognition(): SpeechRecognitionLike | null {
  const Ctor = getCtor();
  return Ctor ? new Ctor() : null;
}
