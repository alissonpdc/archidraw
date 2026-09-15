import { test, expect, open } from "../fixtures";

const SKIN_BG_PAIRS: Record<string, { light: string; dark: string }> = {
  default: { light: "#f6f7f8", dark: "#101215" },
  warm: { light: "#f7f2ea", dark: "#0c0a07" },
  swiss: { light: "#f0f0ee", dark: "#0e0e0b" },
  midnight: { light: "#f4f6f8", dark: "#0b0d11" },
  blueprint: { light: "#edf1f7", dark: "#080c13" },
};

test.describe("Canvas background pairs match the design spec", () => {
  for (const [skin, expected] of Object.entries(SKIN_BG_PAIRS)) {
    test(`skin "${skin}" applies the expected light/dark backgrounds`, async ({
      page,
    }) => {
      await open(page);

      const lightBg = await page.evaluate(
        (s) => {
          const root = document.documentElement;
          if (s === "default") {
            root.removeAttribute("data-skin");
          } else {
            root.dataset.skin = s;
          }
          root.dataset.theme = "light";
          return getComputedStyle(root).getPropertyValue("--bg-canvas").trim();
        },
        skin,
      );

      const darkBg = await page.evaluate(
        (s) => {
          const root = document.documentElement;
          if (s === "default") {
            root.removeAttribute("data-skin");
          } else {
            root.dataset.skin = s;
          }
          root.dataset.theme = "dark";
          return getComputedStyle(root).getPropertyValue("--bg-canvas").trim();
        },
        skin,
      );

      expect(lightBg.toLowerCase()).toBe(expected.light.toLowerCase());
      expect(darkBg.toLowerCase()).toBe(expected.dark.toLowerCase());
    });
  }

  test("palette swatch pairs match the design spec", async ({ page }) => {
    await open(page);

    const palettePairs = await page.evaluate(() => {
      const root = document.documentElement;

      root.removeAttribute("data-skin");
      root.dataset.theme = "light";
      const defaultLight = getComputedStyle(root)
        .getPropertyValue("--bg-canvas")
        .trim();

      root.dataset.theme = "dark";
      const defaultDark = getComputedStyle(root)
        .getPropertyValue("--bg-canvas")
        .trim();

      root.dataset.skin = "warm";
      root.dataset.theme = "light";
      const warmLight = getComputedStyle(root)
        .getPropertyValue("--bg-canvas")
        .trim();
      root.dataset.theme = "dark";
      const warmDark = getComputedStyle(root)
        .getPropertyValue("--bg-canvas")
        .trim();

      root.dataset.skin = "swiss";
      root.dataset.theme = "light";
      const swissLight = getComputedStyle(root)
        .getPropertyValue("--bg-canvas")
        .trim();
      root.dataset.theme = "dark";
      const swissDark = getComputedStyle(root)
        .getPropertyValue("--bg-canvas")
        .trim();

      root.dataset.skin = "midnight";
      root.dataset.theme = "light";
      const midnightLight = getComputedStyle(root)
        .getPropertyValue("--bg-canvas")
        .trim();
      root.dataset.theme = "dark";
      const midnightDark = getComputedStyle(root)
        .getPropertyValue("--bg-canvas")
        .trim();

      root.dataset.skin = "blueprint";
      root.dataset.theme = "light";
      const blueprintLight = getComputedStyle(root)
        .getPropertyValue("--bg-canvas")
        .trim();
      root.dataset.theme = "dark";
      const blueprintDark = getComputedStyle(root)
        .getPropertyValue("--bg-canvas")
        .trim();

      return {
        default: { light: defaultLight, dark: defaultDark },
        warm: { light: warmLight, dark: warmDark },
        swiss: { light: swissLight, dark: swissDark },
        midnight: { light: midnightLight, dark: midnightDark },
        blueprint: { light: blueprintLight, dark: blueprintDark },
      };
    });

    expect(palettePairs.default.light.toLowerCase()).toBe(
      SKIN_BG_PAIRS.default.light.toLowerCase(),
    );
    expect(palettePairs.default.dark.toLowerCase()).toBe(
      SKIN_BG_PAIRS.default.dark.toLowerCase(),
    );
    expect(palettePairs.warm.light.toLowerCase()).toBe(
      SKIN_BG_PAIRS.warm.light.toLowerCase(),
    );
    expect(palettePairs.warm.dark.toLowerCase()).toBe(
      SKIN_BG_PAIRS.warm.dark.toLowerCase(),
    );
    expect(palettePairs.swiss.light.toLowerCase()).toBe(
      SKIN_BG_PAIRS.swiss.light.toLowerCase(),
    );
    expect(palettePairs.swiss.dark.toLowerCase()).toBe(
      SKIN_BG_PAIRS.swiss.dark.toLowerCase(),
    );
    expect(palettePairs.midnight.light.toLowerCase()).toBe(
      SKIN_BG_PAIRS.midnight.light.toLowerCase(),
    );
    expect(palettePairs.midnight.dark.toLowerCase()).toBe(
      SKIN_BG_PAIRS.midnight.dark.toLowerCase(),
    );
    expect(palettePairs.blueprint.light.toLowerCase()).toBe(
      SKIN_BG_PAIRS.blueprint.light.toLowerCase(),
    );
    expect(palettePairs.blueprint.dark.toLowerCase()).toBe(
      SKIN_BG_PAIRS.blueprint.dark.toLowerCase(),
    );
  });
});
