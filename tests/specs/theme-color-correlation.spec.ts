import { test, expect, open, selectTool, drag } from "../fixtures";
import type { Page } from "@playwright/test";
import { BASE_COLORS, shadesOf } from "../../src/core/color";

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.evaluate(async (t) => {
    document.documentElement.dataset.theme = t;
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
  }, theme);
  await page.waitForTimeout(150);
}

test.describe("Theme color intensity correlation", () => {
  test("correlateIntensity satisfies all rules across all 15 base colors", async ({
    page,
  }) => {
    await open(page);

    const results = await page.evaluate(() => {
      const { BASE_COLORS, shadesOf, correlateIntensity } = (window as any).__color__;
      const failures: string[] = [];

      for (const base of BASE_COLORS) {
        const shades = shadesOf(base.color);

        if (correlateIntensity(shades[2]) !== shades[2]) {
          failures.push(`Intensity 3 not constant for ${base.name}`);
        }

        if (correlateIntensity(shades[0]) !== shades[4]) {
          failures.push(`Intensity 1 did not become 5 for ${base.name}`);
        }
        if (correlateIntensity(shades[4]) !== shades[0]) {
          failures.push(`Intensity 5 did not become 1 for ${base.name}`);
        }

        if (correlateIntensity(shades[1]) !== shades[3]) {
          failures.push(`Intensity 2 did not become 4 for ${base.name}`);
        }
        if (correlateIntensity(shades[3]) !== shades[1]) {
          failures.push(`Intensity 4 did not become 2 for ${base.name}`);
        }

        for (let i = 0; i < 5; i++) {
          if (correlateIntensity(correlateIntensity(shades[i])) !== shades[i]) {
            failures.push(`Double inversion failed for ${base.name} shade ${i}`);
          }
        }
      }

      const emptyRes = correlateIntensity("");
      const transRes = correlateIntensity("transparent");
      const hexRes = correlateIntensity("#123456");

      return { failures, emptyRes, transRes, hexRes };
    });

    expect(results.failures).toEqual([]);
    expect(results.emptyRes).toBe("");
    expect(results.transRes).toBe("transparent");
    expect(results.hexRes).toBe("#123456");
  });

  test("switching mode automatically correlates element stroke, fill, and text intensities", async ({
    page,
  }) => {
    await open(page);

    const blueShades = shadesOf(BASE_COLORS.find((b) => b.name === "Blue")!.color);
    const redShades = shadesOf(BASE_COLORS.find((b) => b.name === "Red")!.color);
    const greenShades = shadesOf(BASE_COLORS.find((b) => b.name === "Green")!.color);
    const orangeShades = shadesOf(BASE_COLORS.find((b) => b.name === "Orange")!.color);
    const grapeShades = shadesOf(BASE_COLORS.find((b) => b.name === "Grape")!.color);

    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await drag(page, { x: 250, y: 100 }, { x: 350, y: 200 });
    await page.keyboard.press("Escape");

    await page.evaluate(
      ({ blue, red, green, orange, grape }) => {
        const editor = (window as any).__editor__;
        const [el1, el2] = editor.getSnapshot().doc.elements;
        editor.updateElements([el1.id], {
          strokeColor: blue[0],
          backgroundColor: red[1],
          textColor: grape[4],
        });
        editor.updateElements([el2.id], {
          strokeColor: green[2],
          backgroundColor: orange[3],
          textColor: "#3d4248",
        });
      },
      {
        blue: blueShades,
        red: redShades,
        green: greenShades,
        orange: orangeShades,
        grape: grapeShades,
      },
    );

    await setTheme(page, "dark");

    const darkElements = await page.evaluate(() => {
      const elements = (window as any).__editor__.getSnapshot().doc.elements;
      return elements.map((e: any) => ({
        id: e.id,
        strokeColor: e.strokeColor,
        backgroundColor: e.backgroundColor,
        textColor: e.textColor,
      }));
    });

    expect(darkElements[0].strokeColor).toBe(blueShades[4]);
    expect(darkElements[0].backgroundColor).toBe(redShades[3]);
    expect(darkElements[0].textColor).toBe(grapeShades[0]);

    expect(darkElements[1].strokeColor).toBe(greenShades[2]);
    expect(darkElements[1].backgroundColor).toBe(orangeShades[1]);
    expect(darkElements[1].textColor).toBe("#3d4248");

    await setTheme(page, "light");

    const lightElements = await page.evaluate(() => {
      const elements = (window as any).__editor__.getSnapshot().doc.elements;
      return elements.map((e: any) => ({
        id: e.id,
        strokeColor: e.strokeColor,
        backgroundColor: e.backgroundColor,
        textColor: e.textColor,
      }));
    });

    expect(lightElements[0].strokeColor).toBe(blueShades[0]);
    expect(lightElements[0].backgroundColor).toBe(redShades[1]);
    expect(lightElements[0].textColor).toBe(grapeShades[4]);

    expect(lightElements[1].strokeColor).toBe(greenShades[2]);
    expect(lightElements[1].backgroundColor).toBe(orangeShades[3]);
    expect(lightElements[1].textColor).toBe("#3d4248");
  });

  test("preserves DEFAULT_STROKE, CONTEXT_STROKE, and handles multi-tabs and custom default stroke", async ({
    page,
  }) => {
    await open(page);

    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await page.keyboard.press("Escape");

    const initialStroke = await page.evaluate(() => {
      return (window as any).__editor__.getSnapshot().doc.elements[0].strokeColor;
    });
    expect(initialStroke).toBe("#3d4248");

    const blueShades = shadesOf(BASE_COLORS.find((b) => b.name === "Blue")!.color);

    await page.evaluate((blue) => {
      const editor = (window as any).__editor__;
      editor.addTab();
      editor.doc = {
        ...editor.doc,
        elements: [
          ...editor.doc.elements,
          {
            id: "rect-tab2",
            type: "rectangle",
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            strokeColor: blue[0],
            backgroundColor: "transparent",
            strokeWidth: 2,
            opacity: 1,
            strokeOpacity: 1,
            fillOpacity: 1,
            strokeStyle: "solid",
            fillStyle: "solid",
            roughness: 0,
            borderRadius: 0,
            textColor: "#c4c7ca",
          },
        ],
      };

      (editor as any).lastDefaultStroke = blue[0];

      const hist = (editor as any).history;
      hist.push("invalid-json");

      const theme = (window as any).__theme__;
      const cleanup = theme.attachThemeColorCorrelation(editor);
      cleanup();
    }, blueShades);

    await setTheme(page, "dark");

    const darkStroke = await page.evaluate(() => {
      const editor = (window as any).__editor__;
      return {
        tab2Stroke: editor.getSnapshot().doc.elements[0].strokeColor,
        lastDefaultStroke: (editor as any).lastDefaultStroke,
      };
    });
    expect(darkStroke.tab2Stroke).toBe(blueShades[4]);
    expect(darkStroke.lastDefaultStroke).toBe(blueShades[4]);

    await setTheme(page, "light");

    const lightStroke = await page.evaluate(() => {
      const editor = (window as any).__editor__;
      return {
        tab2Stroke: editor.getSnapshot().doc.elements[0].strokeColor,
        lastDefaultStroke: (editor as any).lastDefaultStroke,
      };
    });
    expect(lightStroke.tab2Stroke).toBe(blueShades[0]);
    expect(lightStroke.lastDefaultStroke).toBe(blueShades[0]);
  });

  test("history snapshots are updated so undo retains current mode intensity", async ({
    page,
  }) => {
    await open(page);

    const blueShades = shadesOf(BASE_COLORS.find((b) => b.name === "Blue")!.color);

    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await page.keyboard.press("Escape");

    await page.evaluate((blue) => {
      const editor = (window as any).__editor__;
      const el = editor.getSnapshot().doc.elements[0];
      editor.updateElements([el.id], { strokeColor: blue[0] });
    }, blueShades);

    await selectTool(page, "2");
    await drag(page, { x: 250, y: 100 }, { x: 350, y: 200 });
    await page.keyboard.press("Escape");

    await setTheme(page, "dark");

    const darkStrokeBeforeUndo = await page.evaluate(() => {
      return (window as any).__editor__.getSnapshot().doc.elements[0].strokeColor;
    });
    expect(darkStrokeBeforeUndo).toBe(blueShades[4]);

    await page.keyboard.press("Control+z");

    const darkStrokeAfterUndo = await page.evaluate(() => {
      return (window as any).__editor__.getSnapshot().doc.elements[0].strokeColor;
    });
    expect(darkStrokeAfterUndo).toBe(blueShades[4]);
  });
});
