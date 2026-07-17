import type { Request, Response, NextFunction } from "express";

// A tiny in-memory fixed-window rate limiter — no dependencies. Fine for a
// single-instance prototype; if Yadegar ever scales to multiple instances,
// swap the Map for a shared store (e.g. Redis). Buckets are swept periodically
// so the Map can't grow unbounded.

interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(opts: {
  windowMs: number;
  max: number;
  keyOf: (req: Request) => string;
  skip?: (req: Request) => boolean;
  message?: string;
}) {
  const buckets = new Map<string, Bucket>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }, opts.windowMs);
  sweep.unref?.(); // don't keep the process alive for the timer

  return (req: Request, res: Response, next: NextFunction): void => {
    if (opts.skip?.(req)) return next();
    const key = opts.keyOf(req);
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, b);
    }
    b.count++;
    if (b.count > opts.max) {
      res.setHeader("Retry-After", String(Math.ceil((b.resetAt - now) / 1000)));
      res
        .status(429)
        .json({ error: opts.message ?? "Too many requests — please slow down." });
      return;
    }
    next();
  };
}

export function ipKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function isLoopback(req: Request): boolean {
  const ip = req.ip || req.socket.remoteAddress || "";
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("127.")
  );
}
