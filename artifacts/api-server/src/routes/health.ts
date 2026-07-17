import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Liveness — is the process up and answering? Deliberately DB-free and instant,
// so it never flaps on a slow query. Answers the narrow question "is the server
// running", which is all a restart-on-failure liveness probe needs.
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Readiness — can the app actually serve real traffic, i.e. is the DATABASE
// reachable? This is the endpoint an uptime monitor should watch. The app can be
// "up" (200 on /healthz) while the Postgres endpoint is disabled or suspended —
// exactly the outage that took the site down after a Replit tier downgrade — and
// in that state every real request 500s while /healthz stays green. A DB ping
// catches that; a short timeout keeps a hung/unreachable DB from hanging the
// probe (a stuck check reads as "up" to some monitors).
const DB_PING_TIMEOUT_MS = 3000;

router.get("/readyz", async (req, res): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      pool.query("select 1"),
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("database ping timed out")),
          DB_PING_TIMEOUT_MS,
        );
      }),
    ]);
    res.json({ status: "ok", db: "ok" });
  } catch (err) {
    req.log?.error({ err }, "Readiness check failed — database unreachable");
    res.status(503).json({ status: "error", db: "down" });
  } finally {
    if (timer) clearTimeout(timer);
  }
});

export default router;
