import { readFile } from "node:fs/promises";

const THRESHOLD = 90;
const METRICS = ["lines", "statements", "functions", "branches"];
const LABELS = {
  lines: "Lines",
  statements: "Statements",
  functions: "Functions",
  branches: "Branches",
};
const REPORT_PATH = "test-results/monocart/coverage/coverage-report.json";

let report;
try {
  report = JSON.parse(await readFile(REPORT_PATH, "utf8"));
} catch (err) {
  console.error(`[coverage-gate] failed to read report "${REPORT_PATH}".`);
  console.error(`[coverage-gate] ${err.message}`);
  process.exit(1);
}

const rows = METRICS.map((metric) => {
  const s = report.summary[metric];
  return {
    label: LABELS[metric],
    pct: s.pct,
    covered: s.covered,
    total: s.total,
    ok: s.pct >= THRESHOLD,
  };
});

const failed = rows.filter((row) => !row.ok);

console.log(`[coverage-gate] Required threshold: ${THRESHOLD}% across all analyses\n`);
for (const row of rows) {
  const pct = row.pct.toFixed(1).padStart(5);
  console.log(
    `  ${row.label.padEnd(11)} ${pct}%  (${row.covered}/${row.total})  ${row.ok ? "OK  " : "FAIL"}`,
  );
}

if (failed.length > 0) {
  console.error(
    `\n[coverage-gate] ERROR: ${failed.length} of ${rows.length} analyses below ${THRESHOLD}%: ` +
      failed.map((row) => `${row.label} (${row.pct.toFixed(1)}%)`).join(", "),
  );
  console.error(
    `[coverage-gate] Minimum coverage NOT reached — exit code != 0.`,
  );
  process.exit(1);
}

console.log(`\n[coverage-gate] Minimum coverage reached: OK`);