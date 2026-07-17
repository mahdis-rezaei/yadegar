// Split pasted/uploaded journal text into dated entries. Forgiving by design:
// recognizes several common date formats at the start of a line; text with no
// recognizable dates becomes a single undated entry for the user to date.

export type DateConfidence = "high" | "medium" | "low" | "unknown";

export interface ParsedSegment {
  detectedDate: string | null;
  dateConfidence: DateConfidence;
  title: string | null;
  body: string;
  orderIndex: number;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9,
  sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
const valid = (y: number, m: number, d: number) =>
  y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

interface Hit {
  date: string;
  confidence: DateConfidence;
  rest: string;
}

// Match a date at the START of a line. Returns the normalized date, a
// confidence, and any text remaining on that line.
function matchLeadingDate(line: string): Hit | null {
  let m: RegExpMatchArray | null;

  // [2015-09-24]
  m = line.match(/^\s*\[(\d{4})-(\d{2})-(\d{2})\]\s*(.*)$/);
  if (m && valid(+m[1], +m[2], +m[3])) {
    return { date: `${m[1]}-${m[2]}-${m[3]}`, confidence: "high", rest: m[4] };
  }

  // 2026-03-12
  m = line.match(/^\s*(\d{4})-(\d{2})-(\d{2})\b\s*(.*)$/);
  if (m && valid(+m[1], +m[2], +m[3])) {
    return { date: `${m[1]}-${m[2]}-${m[3]}`, confidence: "high", rest: m[4] };
  }

  // 03/12/2026 (US MM/DD/YYYY)
  m = line.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\b\s*(.*)$/);
  if (m && valid(+m[3], +m[1], +m[2])) {
    return {
      date: `${m[3]}-${pad(+m[1])}-${pad(+m[2])}`,
      confidence: "medium",
      rest: m[4],
    };
  }

  // March 12, 2026  /  Mar 12 2026  /  September 24, 2015
  m = line.match(
    /^\s*([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b\s*(.*)$/,
  );
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month && valid(+m[3], month, +m[2])) {
      return {
        date: `${m[3]}-${pad(month)}-${pad(+m[2])}`,
        confidence: m[1].length <= 3 ? "medium" : "high",
        rest: m[4],
      };
    }
  }

  return null;
}

export function parseImport(raw: string): ParsedSegment[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const segments: ParsedSegment[] = [];

  let current: {
    detectedDate: string | null;
    dateConfidence: DateConfidence;
    body: string;
  } | null = null;

  const flush = () => {
    if (current && current.body.trim()) {
      segments.push({
        detectedDate: current.detectedDate,
        dateConfidence: current.dateConfidence,
        title: null,
        body: current.body.replace(/\n+$/, "").replace(/^\n+/, ""),
        orderIndex: segments.length,
      });
    }
    current = null;
  };

  for (const line of lines) {
    const hit = matchLeadingDate(line);
    if (hit) {
      flush();
      current = {
        detectedDate: hit.date,
        dateConfidence: hit.confidence,
        body: hit.rest ? hit.rest + "\n" : "",
      };
    } else {
      if (!current) {
        // Leading text before any date marker — an undated entry.
        current = { detectedDate: null, dateConfidence: "unknown", body: "" };
      }
      current.body += line + "\n";
    }
  }
  flush();

  return segments;
}
