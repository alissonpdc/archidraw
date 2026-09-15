import { test, expect, open } from "../fixtures";
import { BASE_COLORS, shadesOf, relativeLuminance, parseColor } from "../../src/core/color";
import { BG_PALETTE_LIGHT, BG_PALETTE_DARK } from "../../src/ui/bgPrefs";

function rgbLuminance(hex: string): number {
  const rgb = parseColor(hex);
  if (!rgb) throw new Error(`Invalid color: ${hex}`);
  return relativeLuminance(rgb);
}

function hexLightness(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return ((max + min) / 2) * 100;
}

test.describe("Palette background contrast rules", () => {
  test("light mode backgrounds are strictly lighter than any intensity 1 color", async () => {
    const intensity1Shades = BASE_COLORS.map((b) => {
      const shades = shadesOf(b.color);
      return {
        baseName: b.name,
        color: shades[0],
        lum: rgbLuminance(shades[0]),
        lightness: hexLightness(shades[0]),
      };
    });

    const maxI1Lum = Math.max(...intensity1Shades.map((s) => s.lum));
    const maxI1Lightness = Math.max(...intensity1Shades.map((s) => s.lightness));

    for (const bg of BG_PALETTE_LIGHT) {
      const bgLum = rgbLuminance(bg.id);
      const bgLightness = hexLightness(bg.id);

      expect(
        bgLum,
        `BG ${bg.label} (${bg.id}) lum (${bgLum}) must be greater than max intensity 1 lum (${maxI1Lum})`,
      ).toBeGreaterThan(maxI1Lum);

      expect(
        bgLightness,
        `BG ${bg.label} (${bg.id}) lightness (${bgLightness}) must be greater than max intensity 1 lightness (${maxI1Lightness})`,
      ).toBeGreaterThan(maxI1Lightness);
    }
  });

  test("dark mode backgrounds are strictly darker than any intensity 5 color", async () => {
    const intensity5Shades = BASE_COLORS.map((b) => {
      const shades = shadesOf(b.color);
      return {
        baseName: b.name,
        color: shades[4],
        lum: rgbLuminance(shades[4]),
        lightness: hexLightness(shades[4]),
      };
    });

    const minI5Lum = Math.min(...intensity5Shades.map((s) => s.lum));
    const minI5Lightness = Math.min(...intensity5Shades.map((s) => s.lightness));

    for (const bg of BG_PALETTE_DARK) {
      const bgLum = rgbLuminance(bg.id);
      const bgLightness = hexLightness(bg.id);

      expect(
        bgLum,
        `BG ${bg.label} (${bg.id}) lum (${bgLum}) must be less than min intensity 5 lum (${minI5Lum})`,
      ).toBeLessThan(minI5Lum);

      expect(
        bgLightness,
        `BG ${bg.label} (${bg.id}) lightness (${bgLightness}) must be less than min intensity 5 lightness (${minI5Lightness})`,
      ).toBeLessThan(minI5Lightness);
    }
  });

  test("canvas token background adheres to contrast rules in all skin modes", async ({ page }) => {
    await open(page);

    const skins = ["default", "warm", "swiss", "midnight", "blueprint"];

    for (const skin of skins) {
      for (const mode of ["light", "dark"] as const) {
        const bgCanvas = await page.evaluate(
          ({ s, m }) => {
            const root = document.documentElement;
            if (s === "default") {
              root.removeAttribute("data-skin");
            } else {
              root.dataset.skin = s;
            }
            root.dataset.theme = m;
            return getComputedStyle(root).getPropertyValue("--bg-canvas").trim();
          },
          { s: skin, m: mode },
        );

        const bgLum = rgbLuminance(bgCanvas);
        const bgLightness = hexLightness(bgCanvas);

        if (mode === "light") {
          for (const b of BASE_COLORS) {
            const i1 = shadesOf(b.color)[0];
            const i1Lum = rgbLuminance(i1);
            const i1Lightness = hexLightness(i1);
            expect(
              bgLum,
              `Skin ${skin} light bg ${bgCanvas} lum must exceed ${b.name} intensity 1 (${i1}) lum`,
            ).toBeGreaterThan(i1Lum);
            expect(
              bgLightness,
              `Skin ${skin} light bg ${bgCanvas} lightness must exceed ${b.name} intensity 1 (${i1}) lightness`,
            ).toBeGreaterThan(i1Lightness);
          }
        } else {
          for (const b of BASE_COLORS) {
            const i5 = shadesOf(b.color)[4];
            const i5Lum = rgbLuminance(i5);
            const i5Lightness = hexLightness(i5);
            expect(
              bgLum,
              `Skin ${skin} dark bg ${bgCanvas} lum must be below ${b.name} intensity 5 (${i5}) lum`,
            ).toBeLessThan(i5Lum);
            expect(
              bgLightness,
              `Skin ${skin} dark bg ${bgCanvas} lightness must be below ${b.name} intensity 5 (${i5}) lightness`,
            ).toBeLessThan(i5Lightness);
          }
        }
      }
    }
  });
});
