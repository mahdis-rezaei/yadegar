// mammoth ships types for its Node entry but not the browser build we import
// in extract-text.ts. We only use extractRawText, so declare just that.
declare module "mammoth/mammoth.browser" {
  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: unknown[] }>;
}
