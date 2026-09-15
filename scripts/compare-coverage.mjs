import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const REPORT_PATH = "test-results/monocart/coverage/coverage-report.json";
const BACKUP_DIR = ".coverage-baseline";

async function loadReport(path) {
  const raw = JSON.parse(await readFile(path, "utf8"));
  return raw.summary;
}

async function main() {
  const backupReportPath = `${BACKUP_DIR}/coverage-report.json`;
  if (!existsSync(backupReportPath)) {
    console.log("[compare-coverage] No previous coverage to compare — OK");
    process.exit(0);
  }

  let current, previous;
  try {
    current = await loadReport(REPORT_PATH);
    previous = await loadReport(backupReportPath);
  } catch (err) {
    console.error(`[compare-coverage] Failed to load reports: ${err.message}`);
    process.exit(1);
  }

  const metrics = ["lines", "statements", "functions", "branches", "bytes"];
  const labels = { lines: "Lines", statements: "Statements", functions: "Functions", branches: "Branches", bytes: "Bytes" };

  let hasRegression = false;
  const rows = [];

  for (const metric of metrics) {
    const curPct = current[metric].pct;
    const prevPct = previous[metric].pct;
    const delta = curPct - prevPct;
    const regressed = delta < -0.1;
    if (regressed) hasRegression = true;
    rows.push({ label: labels[metric], curPct, prevPct, delta, regressed });
  }

  console.log("[compare-coverage] Coverage comparison (current vs previous)\n");
  console.log("  Metric        Current   Previous   Delta     Status");
  console.log("  ───────────── ──────── ────────── ───────── ──────");
  for (const r of rows) {
    const deltaStr = `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)}%`.padStart(8);
    const status = r.regressed ? "FAIL" : "OK";
    console.log(
      `  ${r.label.padEnd(13)} ${r.curPct.toFixed(1).padStart(6)}%  ${r.prevPct.toFixed(1).padStart(6)}%   ${deltaStr}   ${status}`,
    );
  }

  if (hasRegression) {
    const regressed = rows.filter((r) => r.regressed);
    console.error(
      `\n[compare-coverage] REGRESSION: ${regressed.map((r) => `${r.label} (${r.delta.toFixed(1)}%)`).join(", ")}`,
    );
    console.error("[compare-coverage] Coverage dropped — exit code != 0.");
    process.exit(1);
  }

  console.log("\n[compare-coverage] No regressions detected — OK");
}

main();
