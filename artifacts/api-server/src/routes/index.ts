import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import privacyRouter from "./privacy";
import reflectionsRouter from "./reflections";
import attachmentsRouter from "./attachments";
import entriesRouter from "./entries";
import memoriesRouter from "./memories";
import continuityRouter from "./continuity";
import lettersRouter from "./letters";
import shelfRouter from "./shelf";
import capsulesRouter from "./capsules";
import collectionsRouter from "./collections";
import preferencesRouter from "./preferences";
import resurfaceMutesRouter from "./resurface-mutes";
import importsRouter from "./imports";
import notificationsRouter from "./notifications";
import cronRouter from "./cron";
import billingRouter from "./billing";
import shopRouter from "./shop";
import stillRouter from "./still";
import { isLoopback } from "../lib/rate-limit";

const router: IRouter = Router();

// The raw engine endpoints (/still/*) are INTERNAL ONLY and bill the Anthropic
// API on every call. Real users never hit them directly — they go through the
// authenticated, rate-limited /memories/run, which calls the engine over
// loopback (ENGINE_BASE = http://127.0.0.1:PORT/api). So we hard-block any
// non-loopback caller outright (previously these were merely rate-limited, which
// a rotating-proxy attacker could bypass to burn the API bill). An optional
// STILL_ENGINE_SECRET lets a trusted out-of-process caller (e.g. the eval
// harness run from elsewhere) through via an X-Engine-Secret header.
function requireInternalEngine(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isLoopback(req)) return next();
  const secret = process.env.STILL_ENGINE_SECRET;
  if (secret && req.header("x-engine-secret") === secret) return next();
  res.status(403).json({ error: "Forbidden" });
}

router.use(healthRouter);
router.use(authRouter);
router.use(privacyRouter);
// Reflections + attachments before entries so /entries/:id/reflections and
// /entries/:id/attachments match here first rather than falling through.
router.use(reflectionsRouter);
router.use(attachmentsRouter);
router.use(entriesRouter);
router.use(memoriesRouter);
router.use(continuityRouter);
router.use(lettersRouter);
router.use(shelfRouter);
router.use(capsulesRouter);
router.use(collectionsRouter);
router.use(preferencesRouter);
router.use(resurfaceMutesRouter);
router.use(importsRouter);
router.use(notificationsRouter);
router.use(cronRouter);
router.use(billingRouter);
router.use(shopRouter);
router.use("/still", requireInternalEngine);
router.use(stillRouter);

export default router;
