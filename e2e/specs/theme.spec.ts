import { test, expect, drag, selectTool, open } from "../fixtures";

import type { Page } from "@playwright/test";
import { ensureContrast, themeColor, parseColor, contrastRatio } from "../../src/core/color";

/**
 * Canvas colors must follow the mode: elements using the theme default stroke
 * store the DEFAULT_STROKE sentinel and the renderer re-resolves it per mode,
 * so toggling dark/light never leaves shapes washed out.
 *
 * Pixel sampling counts pixels near a known stroke boundary that are
 * substantially lighter/darker than the canvas bg (0.15 luminance delta),
 * ignoring grid dots and the bg itself. IMPORTANT: the Chromium console guard
 * fails on repeated canvas readbacks (getImageData perf advisory), so each
 * canvas test performs exactly ONE readback.
 */
async function sampleStroke(
  page: Page,
  region: { x1: number; y1: number; x2: number; y2: number },
): Promise<{ lighter: number; darker: number }> {
  return page.evaluate(({ x1, y1, x2, y2 }) => {
    const canvas = document.querySelector(".canvas") as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d")!;
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue("--bg-canvas").trim();
    // parse bg (supports #rgb and #rrggbb used by the tokens)
    let bgR = 255;
    let bgG = 255;
    let bgB = 255;
    let hx = bg.replace("#", "");
    if (hx.length === 3) hx = hx.split("").map((c) => c + c).join("");
    if (/^[0-9a-fA-F]{6}$/.test(hx)) {
      const n = parseInt(hx, 16);
      bgR = (n >> 16) & 255;
      bgG = (n >> 8) & 255;
      bgB = n & 255;
    }
    const lum = (r: number, g: number, b: number) =>
      (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const bgLum = lum(bgR, bgG, bgB);
    const data = ctx.getImageData(
      x1 * dpr,
      y1 * dpr,
      (x2 - x1) * dpr,
      (y2 - y1) * dpr,
    ).data;
    let lighter = 0;
    let darker = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 200) continue;
      const d = lum(data[i], data[i + 1], data[i + 2]) - bgLum;
      if (d > 0.15) lighter++;
      else if (d < -0.15) darker++;
    }
    return { lighter, darker };
  }, region);
}

const REGION = { x1: 230, y1: 198, x2: 320, y2: 203 };

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.evaluate(async (t) => {
    document.documentElement.dataset.theme = t;
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
  }, theme);
  await page.waitForTimeout(150);
}

test.describe("color resolution", () => {
  test("themeColor swaps the default sentinel for the active element stroke", () => {
    expect(themeColor("#3d4248", "#e2e7ee", "#0b0d11")).toBe("#e2e7ee");
    expect(themeColor("#3d4248", "#1a2028", "#f4f6f8")).toBe("#1a2028");
    expect(themeColor("", "#e2e7ee", "#0b0d11")).toBe("transparent");
    expect(themeColor("transparent", "#e2e7ee", "#0b0d11")).toBe("transparent");
  });

  test("ensureContrast keeps legible colors but clamps dark ones on dark bg", () => {
    expect(ensureContrast("#f5c518", "#0b0d11", 3)).toBe("#f5c518");
    expect(ensureContrast("#1a2028", "#f4f6f8", 3)).toBe("#1a2028");
    const out = ensureContrast("#141414", "#0b0d11", 3);
    expect(out).not.toBe("#141414");
    // the punchline is the invariant: >= 3:1 against the dark canvas
    expect(contrastRatio(parseColor(out)!, parseColor("#0b0d11")!)).toBeGreaterThanOrEqual(3);
  });
});

test.describe("theme", () => {
  test("element drawn in light flips to a legible stroke on dark mode", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 320 });
    await page.keyboard.press("Escape");

    // the stored color is the sentinel, never the mode-baked literal
    const stroke = await page.evaluate(() => {
      const s = (window as any).__editor__.getSnapshot();
      return s.doc.elements[0].strokeColor;
    });
    expect(stroke).toBe("#3d4248");

    await setTheme(page, "dark");
    const s = await sampleStroke(page, REGION);
    expect(s.lighter).toBeGreaterThan(50);
    expect(s.darker).toBe(0);
  });

  test("element drawn in dark flips back to a legible stroke on light mode", async ({
    page,
  }) => {
    await open(page);
    await setTheme(page, "dark");
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 320 });
    await page.keyboard.press("Escape");

    await setTheme(page, "light");
    const s = await sampleStroke(page, REGION);
    expect(s.darker).toBeGreaterThan(50);
    expect(s.lighter).toBe(0);
  });

  test("low-contrast explicit stroke is clamped legible on the dark canvas", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await setTheme(page, "dark");
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 320 });

    const id = (await editorState()).elements[0].id;
    await page.evaluate((elId) => {
      (window as any).__editor__.updateElements([elId], {
        strokeColor: "#141414",
      });
    }, id);
    await page.keyboard.press("Escape");

    // near-black on near-black must be re-resolved lighter, not left invisible
    const s = await sampleStroke(page, REGION);
    expect(s.lighter).toBeGreaterThan(50);
    expect(s.darker).toBe(0);
  });
});