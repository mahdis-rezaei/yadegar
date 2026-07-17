import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Behind Replit's proxy — trust the first hop so req.ip is the real client IP
// (needed for per-IP rate limiting) and secure cookies work.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Content-Security-Policy for the served SPA. Derived from what the web app
// actually loads: everything is same-origin except Google Fonts (the stylesheet
// from fonts.googleapis.com + the font files from fonts.gstatic.com). 'unsafe-inline'
// is allowed for styles only (React/Tailwind inject inline style attributes) —
// never for scripts, so an injected <script> or inline handler is still blocked.
// img-src stays broad (https/data/blob) to cover user-uploaded images without
// pinning a storage origin.
//
// SHADOW BY DEFAULT: shipped as Content-Security-Policy-REPORT-ONLY, which reports
// violations (browser console) but blocks nothing — safe to deploy to the live
// site and tune against real traffic. Flip CSP_ENFORCE=1 to switch to the
// enforcing header once the report-only pass is clean. No code change to enforce.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "form-action 'self'",
].join("; ");
const CSP_HEADER =
  process.env.CSP_ENFORCE === "1"
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";

// Baseline security headers on every response (API + the served SPA). Kept
// dependency-free and deliberately conservative. The four below are safe
// everywhere; the CSP is scoped to the web surface (non-/api) since it governs
// document/asset loads, not JSON the native app reads.
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY"); // clickjacking
  res.setHeader("X-Content-Type-Options", "nosniff"); // MIME sniffing
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains",
    );
  }
  if (!req.path.startsWith("/api")) res.setHeader(CSP_HEADER, CSP);
  next();
});

// Lock CORS to known origins in production; stay permissive in dev. Requests with
// no Origin (same-origin browser requests, native app, server-to-server) are
// always allowed — only cross-origin browser callers are constrained.
const PROD_ORIGINS = new Set([
  "https://yadegarjournal.com",
  "https://www.yadegarjournal.com",
]);
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? (origin, cb) => cb(null, !origin || PROD_ORIGINS.has(origin))
        : true,
    credentials: true,
  }),
);
app.use(cookieParser());
// Stripe webhook signatures are computed over the EXACT raw bytes, so this one
// path must keep its body unparsed. Register the raw parser before the global
// JSON parser (which marks the body parsed and would otherwise consume the
// stream, breaking verification). Every other route still gets JSON below.
app.use("/api/billing/webhook", express.raw({ type: "*/*" }));
// Journal imports can be a whole archive of years pasted at once, well past
// Express's 100kb default — allow a generous body so large imports don't 413.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

// In production, this single service also serves the built frontend (the SPA),
// so one deployment serves both the app and /api. The static build location can
// vary with the deploy's working directory, so probe the likely spots (or set
// STATIC_DIR explicitly). In dev this is skipped — Vite serves the frontend.
function resolveStaticDir(): string | null {
  const candidates = [
    process.env.STATIC_DIR,
    path.resolve(process.cwd(), "artifacts/still/dist/public"),
    path.resolve(process.cwd(), "../still/dist/public"),
    path.resolve(process.cwd(), "dist/public"),
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(path.join(p, "index.html"))) ?? null;
}

if (process.env.NODE_ENV === "production") {
  const staticDir = resolveStaticDir();
  if (staticDir) {
    app.use(express.static(staticDir));
    // SPA fallback: any non-/api GET serves index.html so client-side routes
    // (e.g. /library, /settings/privacy) work on refresh / direct load.
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) return next();
      res.sendFile(path.join(staticDir, "index.html"));
    });
    logger.info({ staticDir }, "Serving built frontend");
  } else {
    logger.warn(
      "NODE_ENV=production but no built frontend found (set STATIC_DIR or build @workspace/still)",
    );
  }
}

// Global error handler (must be last). Without this, an unhandled error falls to
// Express's default handler, which can leak a stack trace if NODE_ENV is ever
// unset. Log the full error server-side; return a generic message to the client.
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "Unhandled error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;
