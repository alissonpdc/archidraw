import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT) || 4173;
const withCoverage = process.env.E2E_COVERAGE === "1";

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 30_000,
  retries: 0,
  workers: 10,
  reporter: withCoverage
    ? [
        ["list"],
        [
          "monocart-reporter",
          {
            name: "archidraw e2e",
            outputFile: "test-results/monocart/index.html",
            coverage: {
              outputDir: "test-results/monocart/coverage",
              entryFilter: (entry) => entry.url.includes("assets/"),
              sourceFilter: (sourcePath) =>
                sourcePath.startsWith("src/") &&
                (sourcePath.endsWith(".ts") || sourcePath.endsWith(".tsx")),
              reports: ["v8", "v8-json", "console-summary"],
            },
          },
        ],
      ]
    : undefined,
  use: {
    baseURL: `http://localhost:${port}`,
    browserName: "chromium",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: `npm run build:test && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
