import { fixtures } from "./fixtures";
import { runEngine, mode } from "./adapter";
import {
  evaluateCase,
  openerSignature,
  type CaseReport,
  type Check,
} from "./checks";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function mark(pass: boolean): string {
  return pass ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
}

function allPass(checks: Check[]): boolean {
  return checks.every((c) => c.pass);
}

async function main() {
  console.log(
    `\n${BOLD}Still eval harness${RESET} ${DIM}(mode: ${mode})${RESET}\n`,
  );

  const reports: CaseReport[] = [];
  const surfacedOpeners: { id: string; sig: string; observation: string }[] =
    [];
  let selPass = 0;
  let selTotal = 0;
  let voicePass = 0;
  let voiceTotal = 0;
  let skipped = 0;

  for (const fx of fixtures) {
    const outcome = await runEngine(fx);

    if (outcome.status === "skipped") {
      skipped++;
      console.log(
        `${YELLOW}–${RESET} ${fx.title} ${DIM}(${outcome.reason})${RESET}`,
      );
      continue;
    }
    if (outcome.status === "error" || !outcome.result) {
      console.log(
        `${RED}!${RESET} ${fx.title} ${DIM}(engine error: ${outcome.reason})${RESET}`,
      );
      continue;
    }

    const res = outcome.result;
    const report = evaluateCase(fx, res);
    reports.push(report);

    const selOk = allPass(report.selection);
    selTotal++;
    if (selOk) selPass++;

    const hasVoice = report.voice.length > 0;
    const voiceOk = hasVoice && allPass(report.voice);
    if (hasVoice) {
      voiceTotal++;
      if (voiceOk) voicePass++;
    }

    if (res.result.observation) {
      surfacedOpeners.push({
        id: fx.id,
        sig: openerSignature(res.result.observation),
        observation: res.result.observation,
      });
    }

    const head = selOk && (!hasVoice || voiceOk) ? GREEN : RED;
    console.log(`\n${head}${BOLD}${fx.title}${RESET}`);
    console.log(`  ${DIM}${fx.note ?? ""}${RESET}`);

    console.log(`  ${BOLD}selection${RESET}`);
    for (const c of report.selection) {
      console.log(`    ${mark(c.pass)} ${c.name} ${DIM}— ${c.detail}${RESET}`);
    }
    if (hasVoice) {
      console.log(`  ${BOLD}voice${RESET}`);
      for (const c of report.voice) {
        console.log(
          `    ${mark(c.pass)} ${c.name} ${DIM}— ${c.detail}${RESET}`,
        );
      }
    }
    for (const d of report.diagnostics) {
      console.log(`    ${YELLOW}⚠${RESET} ${DIM}${d}${RESET}`);
    }
  }

  // Cross-result opener uniqueness (harness-only — model can't self-enforce it).
  const sigCounts = new Map<string, string[]>();
  for (const o of surfacedOpeners) {
    const list = sigCounts.get(o.sig) ?? [];
    list.push(o.id);
    sigCounts.set(o.sig, list);
  }
  const dupes = [...sigCounts.values()].filter((ids) => ids.length > 1);

  console.log(`\n${BOLD}── Scorecard ──${RESET}`);
  console.log(`  Selection: ${selPass}/${selTotal}`);
  console.log(
    `  Voice:     ${voicePass}/${voiceTotal}${voiceTotal === 0 ? ` ${DIM}(no observations to score)${RESET}` : ""}`,
  );
  if (skipped)
    console.log(
      `  ${DIM}Skipped:   ${skipped} (no recording; use STILL_MODE=http)${RESET}`,
    );
  if (surfacedOpeners.length > 1) {
    if (dupes.length === 0) {
      console.log(
        `  ${GREEN}✓${RESET} opener variety: all ${surfacedOpeners.length} surfaced openings differ`,
      );
    } else {
      console.log(
        `  ${RED}✗${RESET} opener variety: repeated openings — ${dupes.map((d) => d.join("/")).join(", ")}`,
      );
    }
  }

  const failed = reports.filter(
    (r) => !allPass(r.selection) || (r.voice.length > 0 && !allPass(r.voice)),
  );
  console.log("");
  if (failed.length === 0 && skipped < fixtures.length) {
    console.log(`${GREEN}${BOLD}All scored cases passed.${RESET}\n`);
    process.exit(0);
  } else {
    console.log(
      `${RED}${BOLD}${failed.length} case(s) failing:${RESET} ${failed.map((r) => r.id).join(", ")}\n`,
    );
    process.exit(failed.length > 0 ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
