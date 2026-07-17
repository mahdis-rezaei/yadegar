// Pull plain text out of a .docx upload *in the browser*, so the import API
// contract stays "rawText in", no binary upload, nothing new for the server to
// decrypt or store. mammoth reads Word's actual text in document order, so it is
// faithful for English and right-to-left scripts (e.g. Farsi) alike.
//
// PDF is intentionally NOT supported. A PDF stores positioned glyphs, not text,
// so any extraction reorders/space-splits words and badly mangles RTL text, // unacceptable for a journal we promise never to alter. The faithful paths are
// paste and .docx (Google Doc / Word -> Download -> .docx).
import * as mammoth from "mammoth/mammoth.browser";

async function fromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// Returns extracted plain text. Throws a friendly Error if the file has no
// readable text (e.g. a scanned/photographed page, or an old binary .doc).
export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const text = name.endsWith(".docx") ? await fromDocx(file) : await file.text();
  if (!text.trim()) {
    throw new Error(
      "Couldn't find any text in that file. If it's a scanned image or photo, try pasting the words instead.",
    );
  }
  return text;
}
