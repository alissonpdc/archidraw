import { availableParallelism } from "node:os";
import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT) || 4173;
const withCoverage = process.env.E2E_COVERAGE === "1";
const defaultWorkers = Math.max(2, Math.floor(availableParallelism() / 2));

export default defineConfig({
  testDir: "./tests/specs",
  timeout: 30_000,
  retries: Number(process.env.E2E_RETRIES) || 0,
  workers: Number(process.env.E2E_WORKERS) || defaultWorkers,
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
    // roda contra o servidor Node de produção (mesmo artefato do container),
    // não o preview do Vite — assim o e2e valida o caminho real de produção.
    command: `npm run build:test && npm run build:server && node dist-server/server.js --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
