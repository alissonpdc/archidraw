import { test, expect, open } from "../fixtures";

declare global {
  interface Window {
    __color__?: {
      parseColor: (c: string) => { r: number; g: number; b: number; a: number } | null;
      ensureContrast: (
        c: string,
        bg: string,
        minRatio?: number,
      ) => string;
      themeColor: (c: string, stroke: string, bg: string) => string;
      contrastRatio: (
        a: { r: number; g: number; b: number; a: number },
        b: { r: number; g: number; b: number; a: number },
      ) => number;
      relativeLuminance: (c: { r: number; g: number; b: number; a: number }) => number;
    };
  }
}

test.describe("color utilities", () => {
  test("parseColor handles every supported syntax and rejects garbage", async ({
    page,
  }) => {
    await open(page);

    const cases = await page.evaluate(() => {
      const { parseColor } = window.__color__!;
      return {
        transparent: parseColor("transparent"),
        none: parseColor("none"),
        hex3: parseColor("#abc"),
        hex4: parseColor("#abcd"),
        hex6: parseColor("#ff00ff"),
        hex8: parseColor("#ff00ff80"),
        badHex: parseColor("#gggggg"),
        rgb: parseColor("rgb(10, 20, 30)"),
        rgbaPct: parseColor("rgba(10, 20, 30, 50%)"),
        rgbaNum: parseColor("rgba(10, 20, 30, 0.4)"),
        garbage: parseColor("not-a-color"),
      };
    });

    expect(cases.transparent).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(cases.none).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(cases.hex3).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 1 });
    expect(cases.hex4).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 0xdd / 255 });
    expect(cases.hex6).toEqual({ r: 255, g: 0, b: 255, a: 1 });
    expect(cases.hex8).toEqual({ r: 255, g: 0, b: 255, a: 0x80 / 255 });
    expect(cases.badHex).toBeNull();
    expect(cases.rgb).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(cases.rgbaPct).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(cases.rgbaNum).toEqual({ r: 10, g: 20, b: 30, a: 0.4 });
    expect(cases.garbage).toBeNull();
  });

  test("ensureContrast keeps legible colors, clamps low-contrast ones", async ({
    page,
  }) => {
    await open(page);

    const out = await page.evaluate(() => {
      const { ensureContrast, contrastRatio, parseColor, relativeLuminance } =
        window.__color__!;
      const alreadyLegible = ensureContrast("#f5c518", "#0b0d11", 3);
      const unparseable = ensureContrast("zzz", "#0b0d11", 3);
      const transparent = ensureContrast("transparent", "#0b0d11", 3);
      const translucid = ensureContrast("rgba(10, 20, 30, 0.5)", "#0b0d11", 3);
      const dark = ensureContrast("#141414", "#0b0d11", 3);
      const light = ensureContrast("#fafafa", "#ffffff", 3);
      const ratio = (fg: string, bg: string) =>
        contrastRatio(parseColor(fg)!, parseColor(bg)!);
      return {
        alreadyLegible,
        unparseable,
        transparent,
        translucid,
        darkRatio: ratio(dark, "#0b0d11"),
        darkChanged: dark !== "#141414",
        lightRatio: ratio(light, "#ffffff"),
        lightChanged: light !== "#fafafa",
        lightDarker:
          relativeLuminance(parseColor(light)!) <
          relativeLuminance(parseColor("#fafafa")!),
      };
    });

    expect(out.alreadyLegible).toBe("#f5c518");
    expect(out.unparseable).toBe("zzz");
    expect(out.transparent).toBe("transparent");
    expect(out.translucid).toBe("rgba(10, 20, 30, 0.5)");
    expect(out.darkRatio).toBeGreaterThanOrEqual(3);
    expect(out.darkChanged).toBe(true);
    expect(out.lightRatio).toBeGreaterThanOrEqual(3);
    expect(out.lightChanged).toBe(true);
    expect(out.lightDarker).toBe(true);
  });

  test("themeColor resolves the default sentinel and passthroughs", async ({
    page,
  }) => {
    await open(page);

    const out = await page.evaluate(() => {
      const { themeColor } = window.__color__!;
      return {
        empty: themeColor("", "#e2e7ee", "#0b0d11"),
        transparent: themeColor("transparent", "#e2e7ee", "#0b0d11"),
        default: themeColor("#3d4248", "#e2e7ee", "#0b0d11"),
        explicit: themeColor("#ffffff", "#e2e7ee", "#0b0d11"),
      };
    });

    expect(out.empty).toBe("transparent");
    expect(out.transparent).toBe("transparent");
    expect(out.default).toBe("#e2e7ee");
    expect(out.explicit).not.toBe("#3d4248");
  });

  test("ensureContrast clamps colors across every hue sector and gray", async ({
    page,
  }) => {
    await open(page);
    const out = await page.evaluate(() => {
      const { ensureContrast, contrastRatio, parseColor } = window.__color__!;
      const hues = [
        "#700000", // red
        "#005000", // green
        "#005050", // cyan
        "#003060", // blue
        "#400840", // magenta
        "#501050", // pink
        "#141414", // gray (achromatic)
      ];
      return hues.map((c) => {
        const clamped = ensureContrast(c, "#0b0d11", 3);
        return {
          changed: clamped !== c,
          ratio: contrastRatio(parseColor(clamped)!, parseColor("#0b0d11")!),
        };
      });
    });
    for (const row of out) {
      expect(row.changed).toBe(true);
      expect(row.ratio).toBeGreaterThanOrEqual(3);
    }
  });
});