import { test, expect, open } from "../fixtures";
import type { Page } from "@playwright/test";
import { locate } from "../../src/core/color";

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.evaluate(async (t) => {
    document.documentElement.dataset.theme = t;
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
  }, theme);
  await page.waitForTimeout(200);
}

test.describe("library dark mode insertion", () => {
  test("inserting a native library item in dark mode adapts to dark colors and correlates to light mode properly", async ({
    page,
  }) => {
    await open(page);

    // 1. Switch to dark mode
    await setTheme(page, "dark");

    // Verify editor is in dark mode
    const isDark = await page.evaluate(() => (window as any).__editor__.isDarkMode);
    expect(isDark).toBe(true);

    // 2. Insert a native library item ("User" from clients-devices)
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.insertComponent("sd-clients-devices-user");
    });

    // 3. Check colors immediately in dark mode
    const darkColors = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements = ed.getSnapshot().doc.elements;
      return elements.map((e: any) => ({
        id: e.id,
        type: e.type,
        strokeColor: e.strokeColor,
        backgroundColor: e.backgroundColor,
      }));
    });

    expect(darkColors.length).toBeGreaterThan(0);

    // In dark mode, shapes should have dark fills (intensity 4 or 5) and light strokes (intensity 1 or 2)
    for (const el of darkColors) {
      if (el.type !== "text") {
        if (el.backgroundColor && el.backgroundColor !== "transparent") {
          const loc = locate(el.backgroundColor);
          expect(loc).not.toBeNull();
          expect(loc!.intensity).toBeGreaterThanOrEqual(3);
        }
        if (el.strokeColor && el.strokeColor !== "transparent" && el.strokeColor !== "#3d4248") {
          const loc = locate(el.strokeColor);
          expect(loc).not.toBeNull();
          expect(loc!.intensity).toBeLessThanOrEqual(2);
        }
      }
    }

    // 4. Switch to light mode
    await setTheme(page, "light");

    const lightColors = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements = ed.getSnapshot().doc.elements;
      return elements.map((e: any) => ({
        id: e.id,
        type: e.type,
        strokeColor: e.strokeColor,
        backgroundColor: e.backgroundColor,
      }));
    });

    // In light mode, shapes should have light fills (intensity 0 or 1) and dark strokes (intensity 3 or 4)
    for (const el of lightColors) {
      if (el.type !== "text") {
        if (el.backgroundColor && el.backgroundColor !== "transparent") {
          const loc = locate(el.backgroundColor);
          expect(loc).not.toBeNull();
          expect(loc!.intensity).toBeLessThanOrEqual(1);
        }
        if (el.strokeColor && el.strokeColor !== "transparent" && el.strokeColor !== "#3d4248") {
          const loc = locate(el.strokeColor);
          expect(loc).not.toBeNull();
          expect(loc!.intensity).toBeGreaterThanOrEqual(3);
        }
      }
    }

    // 5. Switch back to dark mode
    await setTheme(page, "dark");

    const reDarkColors = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements = ed.getSnapshot().doc.elements;
      return elements.map((e: any) => ({
        id: e.id,
        type: e.type,
        strokeColor: e.strokeColor,
        backgroundColor: e.backgroundColor,
      }));
    });

    expect(reDarkColors).toEqual(darkColors);
  });

  test("saving custom component in dark mode stores canonical light format and restores correctly in both modes", async ({
    page,
  }) => {
    await open(page);

    // 1. Draw a rectangle in light mode with Blue 4 stroke and Red 1 fill
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.doc = {
        ...ed.doc,
        elements: [
          {
            id: "rect-custom-test",
            type: "rectangle",
            x: 100,
            y: 100,
            width: 80,
            height: 60,
            strokeColor: "#114c83", // Blue 4
            backgroundColor: "#edd4d4", // Red 1
            strokeWidth: 2,
            opacity: 1,
            strokeOpacity: 1,
            fillOpacity: 1,
            strokeStyle: "solid",
            fillStyle: "solid",
            roughness: 0,
            borderRadius: 0,
          },
        ],
      };
      ed.emit();
    });

    // 2. Switch to dark mode
    await setTheme(page, "dark");

    // 3. Add to library via Custom Library API
    const customItem = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const selected = ed.doc.elements;
      const canonical = ed.isDarkMode
        ? selected.map((el: any) => ed.correlateElement(el))
        : selected;
      const { addCustomItem } = (window as any).__customLibrary__ ?? {};
      if (addCustomItem) {
        return addCustomItem(canonical, "<svg></svg>", 1);
      }
      return null;
    });

    // 4. Insert the custom component in dark mode
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.doc.elements = []; // clear canvas
      ed.emit();
      // Insert item
      const item = (window as any).__editor__.insertComponent("custom-1");
    });

    const insertedInDark = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return el ? { strokeColor: el.strokeColor, backgroundColor: el.backgroundColor } : null;
    });

    if (insertedInDark) {
      // In dark mode: Blue 4 should have become Blue 2 (#72a8d9) and Red 1 should have become Red 5 (#470b0b)
      expect(insertedInDark.strokeColor).toBe("#72a8d9");
      expect(insertedInDark.backgroundColor).toBe("#470b0b");
    }

    // 5. Switch to light mode
    await setTheme(page, "light");

    const convertedToLight = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return el ? { strokeColor: el.strokeColor, backgroundColor: el.backgroundColor } : null;
    });

    if (convertedToLight) {
      // In light mode: Blue 2 becomes Blue 4 (#114c83) and Red 5 becomes Red 1 (#edd4d4)
      expect(convertedToLight.strokeColor).toBe("#114c83");
      expect(convertedToLight.backgroundColor).toBe("#edd4d4");
    }
  });

  test("IoT Device inner die and label have proper contrast in dark mode", async ({
    page,
  }) => {
    await open(page);
    await setTheme(page, "dark");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.insertComponent("sd-clients-devices-iot-device");
    });

    const iotDie = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements.find((e: any) => e.label === "IoT");
      return el ? { strokeColor: el.strokeColor, textColor: el.textColor, backgroundColor: el.backgroundColor } : null;
    });

    expect(iotDie).not.toBeNull();
    // In dark mode, die stroke and text use DEFAULT_STROKE sentinel (#3d4248) which renders as light stroke #e0e0e0
    expect(iotDie!.strokeColor).toBe("#3d4248");
    expect(iotDie!.textColor).toBe("#3d4248");
  });

  test("Developer laptop keyboard and Browser frame invert properly in dark mode", async ({
    page,
  }) => {
    await open(page);
    await setTheme(page, "dark");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.insertComponent("sd-clients-devices-developer");
      ed.insertComponent("sd-clients-devices-browser");
    });

    const res = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements = ed.getSnapshot().doc.elements;
      // keyboard is the rectangle with height ~8.61
      const kb = elements.find((e: any) => e.type === "rectangle" && Math.abs(e.height - 8.61) < 0.1);
      // outer frame of browser is the rectangle with width ~126.99
      const frame = elements.find((e: any) => e.type === "rectangle" && Math.abs(e.width - 126.99) < 0.1);
      return {
        kbStroke: kb?.strokeColor,
        frameStroke: frame?.strokeColor,
      };
    });

    expect(res.kbStroke).toBe("#3d4248");
    expect(res.frameStroke).toBe("#3d4248");
  });

  test("Vector Database renders as a standard cylinder with interconnected vector nodes", async ({
    page,
  }) => {
    await open(page);

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.insertComponent("sd-data-storage-vector-database");
    });

    const info = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements = ed.getSnapshot().doc.elements;
      const body = elements.find((e: any) => e.type === "polygon");
      const top = elements.find((e: any) => e.type === "ellipse" && e.width > 50);
      const nodes = elements.filter((e: any) => e.type === "ellipse" && e.width <= 15);
      const lines = elements.filter((e: any) => e.type === "line");
      const label = elements.find((e: any) => e.type === "text");
      return {
        hasBody: !!body && body.strokeColor === "#168866" && body.backgroundColor === "#d4ede5",
        hasTop: !!top && top.strokeColor === "#168866" && top.backgroundColor === "#7dd9be",
        nodeCount: nodes.length,
        lineCount: lines.length,
        labelText: label?.text,
      };
    });

    expect(info.hasBody).toBe(true);
    expect(info.hasTop).toBe(true);
    expect(info.nodeCount).toBe(5);
    expect(info.lineCount).toBe(8);
    expect(info.labelText).toBe("Vector Database");
  });

  test("Database Cluster renders both Writer and Reader as cylinders without loose bottom ellipses", async ({
    page,
  }) => {
    await open(page);

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.insertComponent("sd-data-storage-database-cluster");
    });

    const info = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements = ed.getSnapshot().doc.elements;
      const cylinders = elements.filter((e: any) => e.type === "polygon");
      const ellipses = elements.filter((e: any) => e.type === "ellipse");
      const rectangles = elements.filter((e: any) => e.type === "rectangle");
      const arrow = elements.find((e: any) => e.type === "arrow");
      const label = elements.find((e: any) => e.type === "text");
      return {
        cylinderCount: cylinders.length,
        ellipseCount: ellipses.length,
        rectangleCount: rectangles.length,
        hasArrow: !!arrow,
        labelText: label?.text,
        writerLabel: cylinders.find((c: any) => c.label === "Writer")?.label,
        readerLabel: cylinders.find((c: any) => c.label === "Reader")?.label,
      };
    });

    expect(info.cylinderCount).toBe(2);
    // Only 2 top caps, no loose bottom ellipses:
    expect(info.ellipseCount).toBe(2);
    // No rectangular bodies:
    expect(info.rectangleCount).toBe(0);
    expect(info.hasArrow).toBe(true);
    expect(info.labelText).toBe("Database Cluster");
    expect(info.writerLabel).toBe("Writer");
    expect(info.readerLabel).toBe("Reader");
  });
});
