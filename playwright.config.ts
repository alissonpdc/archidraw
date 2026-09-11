import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT) || 4173;

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 30_000,
  retries: 0,
  workers: 1,
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
