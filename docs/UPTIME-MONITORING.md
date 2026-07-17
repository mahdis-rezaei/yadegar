# Uptime monitoring

Goal: **you learn the site is down before your users do.** The July outage was
found only because a cron job failed — there was no alert. This closes that gap.

## The two health endpoints

| Endpoint | Checks | Use it for |
|---|---|---|
| `GET /api/healthz` | Process is up and answering. **Does not touch the DB.** | Liveness (a restart-on-failure probe). |
| `GET /api/readyz` | Process is up **and the database is reachable** (`select 1`, 3s timeout). Returns `503` when the DB is down. | **Uptime monitoring — watch this one.** |

Why `/readyz` and not `/healthz`: the app can be "up" (200 on `/healthz`) while
the Postgres endpoint is disabled or suspended — exactly what happened after the
Replit Pro → $20 downgrade. In that state every real request 500s but `/healthz`
stays green, so a monitor on it would report "all healthy." `/readyz` pings the
DB, so it actually goes red.

Both are public, unauthenticated, and cheap (`select 1`), so they're safe to
hit every minute.

## Set up the monitor (one-time, ~5 min)

Any uptime service works. **UptimeRobot** (free tier) or **BetterStack** are the
easy picks.

1. Create a new **HTTP(s) monitor**.
2. URL: `https://yadegarjournal.com/api/readyz`
3. Interval: **1–5 minutes**.
4. Alert condition: **status code is not 200** (a DB-down response is `503`, and
   a full deployment-down is a timeout / connection error — both should page).
5. Notifications: your email + phone (push). Add SMS if the service offers it.
6. Optional second monitor on `https://yadegarjournal.com/` (the landing page)
   so you also catch static/SPA-serving problems.

## When it fires — what it means and what to do

An alert on `/readyz` means one of:

- **Database endpoint disabled/suspended** (most likely on the current Replit
  tier). → Re-enable the Postgres endpoint in Replit, then confirm `/readyz`
  goes back to 200.
- **Deployment is down** (no response / timeout). → Check the Replit Deployment;
  republish via the `docs/REPLIT-SYNC-*.txt` flow if needed.

## Standing risk to keep in mind

On the $20 Replit tier the DB endpoint can be disabled under inactivity or
resource pressure, which takes the whole site down. This monitor makes that
*visible* but doesn't prevent it — if outages recur, the durable fix is a tier
that keeps the DB always-on (or a managed Postgres outside Replit).
