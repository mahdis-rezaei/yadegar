import { logger } from "./logger";

// Transactional email via the Resend REST API (no SDK). From-address and key
// come from the environment. If RESEND_API_KEY is unset (e.g. local dev), we
// log and no-op instead of throwing, so auth flows still work without email.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? "Yadegar <hello@yadegarjournal.com>";
}

function appBase(): string {
  return (process.env.APP_URL ?? "https://yadegarjournal.com").replace(
    /\/+$/,
    "",
  );
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn(
      { to: opts.to, subject: opts.subject },
      "RESEND_API_KEY not set, skipping email send",
    );
    return;
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed: ${res.status} ${body}`);
  }
}

// ── building blocks (calm, on-brand, no marketing) ──────────────────────────

// A branded card: the wordmark + a faint line, a surface card on cream, the
// message, then a quiet footer (a "manage" line for nudges, else the tagline).
function shell(bodyHtml: string, footerHtml?: string): string {
  return `<div style="background:#F2ECDF;padding:32px 14px;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="background:#FFFDF8;border:1px solid #E6DCC9;border-radius:18px;padding:34px 30px;color:#3A2F25;line-height:1.6;">
      <div style="text-align:center;margin-bottom:26px;">
        <div style="font-size:26px;color:#3A2F25;">Yadegar</div>
        <div style="font-size:12px;color:#A59B8D;font-style:italic;margin-top:5px;">a keepsake, the thing that remains</div>
      </div>
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#A59B8D;font-size:12px;font-family:Helvetica,Arial,sans-serif;line-height:1.55;margin:16px 10px 0;">${footerHtml ?? "Yadegar, a companion to a lifelong journaling practice."}</p>
  </div>
</div>`;
}

function wrap(title: string, bodyHtml: string, footerHtml?: string): string {
  return shell(
    `<p style="font-size:21px;color:#3A2F25;margin:0 0 14px;">${title}</p>${bodyHtml}`,
    footerHtml,
  );
}

function para(text: string): string {
  return `<p style="margin:0 0 14px;color:#3A2F25;">${text}</p>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:22px 0;"><a href="${href}" style="background:#3A2F25;color:#F7F1E6;text-decoration:none;padding:12px 24px;border-radius:999px;font-family:Helvetica,Arial,sans-serif;font-size:14px;display:inline-block;">${label}</a></p>`;
}

// Nudge footer, why they're getting it + how to turn it off (a real gap before).
function manageFooter(): string {
  return `You're getting this because your nudges are on. <a href="${appBase()}/settings/notifications" style="color:#8A6F4D;text-decoration:none;">Manage them</a>.`;
}

// ── a warm, personal welcome (from the maker) ───────────────────────────────
export function welcomeEmail(opts: { name?: string | null }): {
  subject: string;
  html: string;
  text: string;
} {
  const hi = opts.name ? `Hey ${opts.name},` : "Hey,";
  const body = [
    para(hi),
    para(
      "I'm Mahdis. I made Yadegar. I'd kept journals for years and wanted something that could quietly hand one page back to me: a thread that kept returning, a day I'd forgotten, always in my own words, and never pushing.",
    ),
    para(
      "There's no streak to keep and no feed to scroll. Write when you want. Everything stays private and encrypted. Yadegar brings back one thing worth sitting with when it's honest, and stays quiet when it isn't.",
    ),
    para(
      "If anything feels off, or you just want to tell me how it's landing, just hit reply, and I read everything.",
    ),
    para("Mahdis"),
  ].join("");
  return {
    subject: "Welcome to Yadegar",
    html: shell(body),
    text:
      `${hi}\n\n` +
      "I'm Mahdis. I made Yadegar. I'd kept journals for years and wanted something that could quietly hand one page back to me: a thread that kept returning, a day I'd forgotten, always in my own words, and never pushing.\n\n" +
      "There's no streak to keep and no feed to scroll. Write when you want. Everything stays private and encrypted. Yadegar brings back one thing worth sitting with when it's honest, and stays quiet when it isn't.\n\n" +
      "If anything feels off, or you just want to tell me how it's landing, just hit reply, and I read everything.\n\nMahdis\n",
  };
}

// ── reached the month's free returns (the high-intent conversion moment) ─────
export function membershipLimitEmail(opts: { name?: string | null }): {
  subject: string;
  html: string;
  text: string;
} {
  const hi = opts.name ? `${opts.name},` : "Hello,";
  const url = `${appBase()}/settings/plan`;
  const lines = [
    "You've brought back all of this month's pages. Nice, that's a real practice of returning.",
    "Revisiting anything that's already come back to you stays free, always. And if you'd like Yadegar to keep reading across your years without waiting for next month, membership opens it up: unlimited fresh returns, $8.99 a month or $59.99 a year.",
  ];
  const body =
    para(hi) +
    lines.map(para).join("") +
    button(url, "See membership") +
    para("Either way, your journal is yours. Mahdis");
  return {
    subject: "You've used this month's returns",
    html: shell(body),
    text: `${hi}\n\n${lines.join("\n\n")}\n\nSee membership: ${url}\n\nEither way, your journal is yours. Mahdis\n`,
  };
}

// ── a warm thank-you when someone becomes a member ──────────────────────────
export function membershipWelcomeEmail(opts: { name?: string | null }): {
  subject: string;
  html: string;
  text: string;
} {
  const hi = opts.name ? `${opts.name},` : "Hello,";
  const url = `${appBase()}/today`;
  const lines = [
    "Thank you for becoming a member of Yadegar. It genuinely means a lot. A small, honest project like this stays alive because of people like you.",
    "Your years are open now: bring a page back whenever the moment calls, and Yadegar will keep reading across all of them, for the threads that return, the pages you'd forgotten, and the distance you've travelled.",
    "Nothing about your journal changes. Writing, keeping, importing, and revisiting what's already come back to you were always free, and always will be. Membership simply lifts the limit on new returns.",
    "You can manage or cancel anytime from Settings → Membership, and your pages remain entirely yours either way.",
  ];
  const body =
    para(hi) +
    lines.map(para).join("") +
    button(url, "Bring a page back") +
    para("Mahdis");
  return {
    subject: "Welcome to Yadegar membership",
    html: shell(body),
    text: `${hi}\n\n${lines.join("\n\n")}\n\nBring a page back: ${url}\n\nMahdis\n`,
  };
}

export function verificationEmail(link: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: "Confirm your email · Yadegar",
    html: wrap(
      "One quick thing.",
      `${para("Confirm this is your email so your pages stay tied to you, and so we can help you back in if you're ever locked out.")}${button(link, "Confirm email")}<p style="font-size:13px;color:#6F675C;">Or paste this link: ${link}</p>`,
    ),
    text: `Confirm this is your email so your pages stay tied to you:\n${link}\n`,
  };
}

// Rotating copy for the recurring writing reminder, so a regular user doesn't get
// the byte-identical email every time. Same calm, no-pressure voice throughout —
// never a streak, never "you haven't journaled." One is picked per send.
const WRITING_NUDGE_VARIANTS: {
  subject: string;
  heading: string;
  body: string;
  cta: string;
}[] = [
  {
    subject: "A page is waiting · Yadegar",
    heading: "What wants to be written today?",
    body: "No streak to keep, nothing to catch up on. Just a quiet moment, if you have one — one honest line is enough.",
    cta: "Write today",
  },
  {
    subject: "Even one line · Yadegar",
    heading: "One sentence is plenty.",
    body: "Not a task, not a habit to keep up. If today gave you one thing worth remembering, it's worth a line.",
    cta: "Open today's page",
  },
  {
    subject: "How are you, really? · Yadegar",
    heading: "How are you, really?",
    body: "The page doesn't need much — a feeling, a small scene, a thought you'd forget by tomorrow. Whatever's true right now.",
    cta: "Write a little",
  },
  {
    subject: "Something worth keeping · Yadegar",
    heading: "What do you want to remember about today?",
    body: "Years from now, the small things are the ones you'll be glad you wrote down. Start with whatever comes.",
    cta: "Keep today",
  },
  {
    subject: "Your page, when you're ready · Yadegar",
    heading: "No rush, no streak.",
    body: "Yadegar keeps your words and, every so often, brings one back. Add to it whenever a moment finds you.",
    cta: "Write today",
  },
];

// Week-of-year, so consecutive weekly reminders land on different copy.
function currentWeekIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export function writingNudgeEmail(
  link: string,
  variant?: number,
): {
  subject: string;
  html: string;
  text: string;
} {
  const v = variant ?? currentWeekIndex();
  const copy = WRITING_NUDGE_VARIANTS[v % WRITING_NUDGE_VARIANTS.length]!;
  return {
    subject: copy.subject,
    html: wrap(copy.heading, `${para(copy.body)}${button(link, copy.cta)}`, manageFooter()),
    text: `${copy.heading} ${copy.cta}: ${link}\n`,
  };
}

export function memoryNudgeEmail(opts: {
  observation?: string | null;
  quote?: string | null;
  quoteDate?: string | null;
  link: string;
}): { subject: string; html: string; text: string } {
  const when = opts.quoteDate ? ` from ${opts.quoteDate}` : "";
  const quoteHtml = opts.quote
    ? `<p style="font-family:Georgia,serif;font-style:italic;font-size:20px;color:#3A2F25;margin:0 0 12px">&ldquo;${opts.quote}&rdquo;</p>`
    : "";
  const obsHtml = opts.observation
    ? `<p style="color:#6F675C">${opts.observation}</p>`
    : "";
  return {
    subject: "A page came back · Yadegar",
    html: wrap(
      `A page${when} came back.`,
      `${quoteHtml}${obsHtml}${button(opts.link, "Read the page")}`,
      manageFooter(),
    ),
    text: `A page${when} came back.\n\n${opts.quote ? `"${opts.quote}"\n\n` : ""}Read it: ${opts.link}\n`,
  };
}

// A date-based "on this day" return, no engine, just a page from this same day
// in a past year. Warm and quiet: a page placed on the desk, never a demand.
export function onThisDayNudgeEmail(opts: {
  monthYear: string; // e.g. "June 2018"
  excerpt: string;
  link: string;
}): { subject: string; html: string; text: string } {
  // Keep the teaser short for an email; the full page is one tap away.
  const teaser =
    opts.excerpt.length > 220
      ? opts.excerpt.slice(0, 219).trimEnd() + "…"
      : opts.excerpt;
  const quoteHtml = `<p style="font-family:Georgia,serif;font-style:italic;font-size:20px;color:#3A2F25;margin:0 0 12px">&ldquo;${teaser}&rdquo;</p>`;
  return {
    subject: "A page came back · Yadegar",
    html: wrap(
      `A page from ${opts.monthYear} came back today.`,
      `${quoteHtml}${button(opts.link, "Read the page")}`,
      manageFooter(),
    ),
    text: `A page from ${opts.monthYear} came back today.\n\n"${teaser}"\n\nRead it: ${opts.link}\n`,
  };
}

// A Memory Capsule has reached its delivery date, a letter the user sealed for
// a later self. Quiet and a little wondrous; the words wait behind a tap.
export function capsuleEmail(link: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: "A page from your past arrived · Yadegar",
    html: wrap(
      "A page from your past arrived today.",
      `${para("You sealed this for a later you, and that's today. It's waiting to be opened.")}${button(link, "Open it")}`,
    ),
    text: `A page from your past arrived today. You sealed it for a later you. Open it: ${link}\n`,
  };
}

export function passwordResetEmail(link: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: "Reset your password · Yadegar",
    html: wrap(
      "Reset your password.",
      `${para("Use the button below to set a new password. It expires in an hour. If you didn't ask for this, you can safely ignore this email, nothing will change.")}${button(link, "Set a new password")}<p style="font-size:13px;color:#6F675C;">Or paste this link: ${link}</p>`,
    ),
    text: `Reset your Yadegar password (expires in 1 hour): ${link}\n\nIf you didn't request this, ignore this email.\n`,
  };
}
