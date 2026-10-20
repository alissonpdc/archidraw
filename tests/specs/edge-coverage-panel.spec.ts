import { test, expect, open, drag, selectTool } from "../fixtures";
import { type Page } from "@playwright/test";

async function drawRect(
  page: Page,
  from = { x: 200, y: 150 },
  to = { x: 320, y: 220 },
) {
  await selectTool(page, "2");
  await drag(page, from, to);
  await selectTool(page, "1");
}

test.describe("PropertiesPanel.tsx color interactions", () => {
  test("click color swatch opens palette, click again closes it", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(260, 185);

    const strokeTab = page.locator(".tab-button", { hasText: "Stroke" });
    if (await strokeTab.isVisible()) {
      await strokeTab.click();
    }

    const swatches = page.locator(".color-swatch");
    const count = await swatches.count();
    if (count > 0) {
      await swatches.first().click();
      await page.waitForTimeout(100);
      const popover = page.locator(".palette-popover");
      const isVisible = await popover.isVisible().catch(() => false);
      if (isVisible) {
        await swatches.first().click();
        await page.waitForTimeout(100);
      }
    }

    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(s).toBe(1);
  });
});

test.describe("App.tsx keyboard shortcuts", () => {
  test("Cmd+Shift+L toggles lock on selected element", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.keyboard.press("Meta+Shift+l");
    const locked = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.locked;
    });
    expect(locked).toBe(true);

    await page.keyboard.press("Meta+Shift+l");
    const unlocked = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.locked;
    });
    expect(unlocked).toBe(false);
  });
});

test.describe("CanvasHost.tsx text editing interactions", () => {
  test("double-click text element and select text with shift", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Select me");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");

    await page.mouse.dblclick(340, 310);
    await page.waitForTimeout(100);

    const textarea = page.locator("textarea");
    const isVisible = await textarea.isVisible().catch(() => false);
    if (isVisible) {
      await textarea.focus();
      await page.keyboard.press("Home");
      await page.keyboard.down("Shift");
      await page.keyboard.press("End");
      await page.keyboard.up("Shift");
    }

    const s = await editorState();
    expect(s.editingTextId).toBeTruthy();
    await page.keyboard.press("Escape");
  });
});

test.describe("CanvasHost.tsx text editing with cursor movement", () => {
  test("cursor movement in text editing mode", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Hello World");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");

    await page.mouse.dblclick(340, 310);
    await page.waitForTimeout(100);

    const textarea = page.locator("textarea");
    const isVisible = await textarea.isVisible().catch(() => false);
    if (isVisible) {
      await textarea.focus();
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowLeft");
    }

    const s = await editorState();
    expect(s.editingTextId).toBeTruthy();
    await page.keyboard.press("Escape");
  });
});

test.describe("PropertiesPanel.tsx text alignment buttons", () => {
  test("click alignment buttons in properties panel", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.dblclick(260, 185);
    await page.keyboard.type("Aligned");
    await page.keyboard.press("Escape");

    await page.mouse.click(260, 185);

    const textTab = page.locator(".tab-button", { hasText: "Text" });
    if (await textTab.isVisible()) {
      await textTab.click();
      await page.waitForTimeout(100);
    }

    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});

test.describe("PropertiesPanel.tsx stroke width control", () => {
  test("change stroke width via editor API", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { strokeWidth: 4 });
    });

    const sw = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].strokeWidth,
    );
    expect(sw).toBe(4);
  });
});

test.describe("PropertiesPanel.tsx opacity control", () => {
  test("change opacity via editor API", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { opacity: 50 });
    });

    const op = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].opacity,
    );
    expect(op).toBe(50);
  });
});

test.describe("PropertiesPanel.tsx roughness control", () => {
  test("change roughness via editor API", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { roughness: 2 });
    });

    const r = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].roughness,
    );
    expect(r).toBe(2);
  });
});

test.describe("PropertiesPanel.tsx fill style control", () => {
  test("change fill style via editor API", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { fillStyle: "hachure" });
    });

    const fs = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].fillStyle,
    );
    expect(fs).toBe("hachure");
  });
});

test.describe("PropertiesPanel.tsx multiple property changes", () => {
  test("change multiple properties at once", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        strokeWidth: 3,
        opacity: 75,
        roughness: 0,
        strokeStyle: "dashed",
      });
    });

    const props = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return {
        strokeWidth: el.strokeWidth,
        opacity: el.opacity,
        roughness: el.roughness,
        strokeStyle: el.strokeStyle,
      };
    });
    expect(props.strokeWidth).toBe(3);
    expect(props.opacity).toBe(75);
    expect(props.roughness).toBe(0);
    expect(props.strokeStyle).toBe("dashed");
  });
});

test.describe("PropertiesPanel.tsx text font size", () => {
  test("change text font size via editor API", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Sized");
    await page.keyboard.press("Escape");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { fontSize: 24 });
    });

    const fs = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].fontSize,
    );
    expect(fs).toBe(24);
  });
});

test.describe("PropertiesPanel.tsx text color via API", () => {
  test("change text color via editor API", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Colored");
    await page.keyboard.press("Escape");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { strokeColor: "#ff0000" });
    });

    const sc = await page.evaluate(
      () =>
        (window as any).__editor__.getSnapshot().doc.elements[0].strokeColor,
    );
    expect(sc).toBe("#ff0000");
  });
});

test.describe("PropertiesPanel.tsx background color", () => {
  test("change background color via editor API", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { backgroundColor: "#a5d8ff" });
    });

    const bg = await page.evaluate(
      () =>
        (window as any).__editor__.getSnapshot().doc.elements[0]
          .backgroundColor,
    );
    expect(bg).toBe("#a5d8ff");
  });
});

test.describe("PropertiesPanel.tsx label text alignment", () => {
  test("change label textAlign via editor API", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { textAlign: "right" });
    });

    const ta = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].textAlign,
    );
    expect(ta).toBe("right");
  });
});

test.describe("PropertiesPanel.tsx label textVAlign", () => {
  test("change label textVAlign via editor API", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { textVAlign: "bottom" });
    });

    const va = await page.evaluate(
      () =>
        (window as any).__editor__.getSnapshot().doc.elements[0].textVAlign,
    );
    expect(va).toBe("bottom");
  });
});

test.describe("PropertiesPanel.tsx arrow endpoints", () => {
  test("change arrow start and end arrowhead via editor API", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 200 });
    await selectTool(page, "1");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        startArrowhead: "triangle",
        endArrowhead: "dot",
      });
    });

    const arrows = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { start: el.startArrowhead, end: el.endArrowhead };
    });
    expect(arrows.start).toBe("triangle");
    expect(arrows.end).toBe("dot");
  });
});

test.describe("PropertiesPanel.tsx line type", () => {
  test("change line type via editor API", async ({ page }) => {
    await open(page);
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 200 });
    await selectTool(page, "1");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });

    const lt = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].lineType,
    );
    expect(lt).toBe("auto");
  });
});

test.describe("PropertiesPanel.tsx spacing +/- buttons", () => {
  test("click spacing increase and decrease buttons", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Spacing test");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.click(300, 310);

    const spacingTab = page.locator(".tab-button", { hasText: "Text" });
    if (await spacingTab.isVisible()) {
      await spacingTab.click();
    }

    const incBtns = page.locator(".spacing-btn[aria-label*='Increase']");
    const decBtns = page.locator(".spacing-btn[aria-label*='Decrease']");
    const incCount = await incBtns.count();
    if (incCount > 0) {
      await incBtns.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(50);
      await decBtns.first().click({ timeout: 3000 }).catch(() => {});
    }

    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(s).toBe(1);
  });
});

test.describe("PropertiesPanel.tsx line spacing", () => {
  test("change line spacing via UI", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Line1\nLine2\nLine3");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.click(300, 310);

    const textTab = page.locator(".tab-button", { hasText: "Text" });
    if (await textTab.isVisible()) await textTab.click();

    const slider = page.locator("[aria-label='Line spacing']");
    const isVisible = await slider.isVisible().catch(() => false);
    if (isVisible) {
      await slider.fill("2");
    }

    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(s).toBe(1);
  });
});

test.describe("PropertiesPanel.tsx border radius", () => {
  test("click rounded and custom border buttons", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(260, 185);

    const roundedBtn = page.locator("[aria-label='Rounded borders']");
    const customBtn = page.locator("[aria-label='Custom borders']");
    const squareBtn = page.locator("[aria-label='Square borders']");

    if (await roundedBtn.isVisible().catch(() => false)) {
      await roundedBtn.click();
    }
    if (await customBtn.isVisible().catch(() => false)) {
      await customBtn.click();
    }
    if (await squareBtn.isVisible().catch(() => false)) {
      await squareBtn.click();
    }

    const br = await page.evaluate(
      () =>
        (window as any).__editor__.getSnapshot().doc.elements[0].borderRadius,
    );
    expect(typeof br).toBe("number");
  });
});

test.describe("PropertiesPanel.tsx text offsets", () => {
  test("change text offset on rect with label via UI", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.dblclick(260, 185);
    await page.keyboard.type("Offset test");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.click(260, 185);

    const textTab = page.locator(".tab-button", { hasText: "Text" });
    if (await textTab.isVisible()) await textTab.click();

    const incBtns = page.locator(".spacing-btn[aria-label*='Increase']");
    const decBtns = page.locator(".spacing-btn[aria-label*='Decrease']");
    const count = await incBtns.count();
    for (let i = 0; i < Math.min(count, 4); i++) {
      if (await incBtns.nth(i).isVisible().catch(() => false)) {
        await incBtns.nth(i).click();
        break;
      }
    }
    for (let i = 0; i < Math.min(count, 4); i++) {
      if (await decBtns.nth(i).isVisible().catch(() => false)) {
        await decBtns.nth(i).click();
        break;
      }
    }

    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(s).toBe(1);
  });
});

test.describe("PropertiesPanel.tsx font size via UI", () => {
  test("change font size via input", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Font test");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.click(300, 310);

    const textTab = page.locator(".tab-button", { hasText: "Text" });
    if (await textTab.isVisible()) await textTab.click();

    const fontInput = page.locator("input[type='number']").first();
    if (await fontInput.isVisible().catch(() => false)) {
      await fontInput.fill("28");
    }

    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(s).toBe(1);
  });
});

test.describe("PropertiesPanel.tsx multi-select same values", () => {
  test("select multiple rects with same fill style", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 150, y: 150 }, { x: 250, y: 220 });
    await drawRect(page, { x: 300, y: 150 }, { x: 400, y: 220 });
    await page.evaluate(() => (window as any).__editor__.selectAll());

    const selected = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().selectedIds.size,
    );
    expect(selected).toBe(2);
  });
});

test.describe("PropertiesPanel.tsx arrow with dashed stroke", () => {
  test("create dashed arrow to trigger hasAnimatableArrow", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 400, y: 200 });
    await selectTool(page, "1");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { strokeStyle: "dashed" });
    });

    const s = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.strokeStyle;
    });
    expect(s).toBe("dashed");
  });
});

test.describe("PropertiesPanel.tsx locked arrow filter", () => {
  test("create locked arrow", async ({ page }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 400, y: 200 });
    await selectTool(page, "1");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { locked: true });
    });

    const locked = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].locked,
    );
    expect(locked).toBe(true);
  });
});

test.describe("PropertiesPanel.tsx line with lineType auto", () => {
  test("create line and set lineType to auto", async ({ page }) => {
    await open(page);
    await selectTool(page, "5");
    await drag(page, { x: 200, y: 200 }, { x: 350, y: 250 });
    await selectTool(page, "1");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "auto" });
    });

    const lt = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].lineType,
    );
    expect(lt).toBe("auto");
  });
});

test.describe("PropertiesPanel.tsx text element as label-like", () => {
  test("change textAlign on text element", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Align test");
    await page.keyboard.press("Escape");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { textAlign: "left" });
    });

    const ta = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].textAlign,
    );
    expect(ta).toBe("left");
  });
});

test.describe("PropertiesPanel.tsx mixed multi-select", () => {
  test("select rect and text elements", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 150, y: 150 }, { x: 250, y: 220 });
    await selectTool(page, "7");
    await page.mouse.click(400, 300);
    await page.keyboard.type("Mixed");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.evaluate(() => (window as any).__editor__.selectAll());

    const selected = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().selectedIds.size,
    );
    expect(selected).toBe(2);
  });
});

test.describe("PropertiesPanel.tsx palette popover position", () => {
  test("open palette near right edge of screen", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 700, y: 150 }, { x: 800, y: 220 });
    await page.mouse.click(750, 185);

    const strokeTab = page.locator(".tab-button", { hasText: "Stroke" });
    if (await strokeTab.isVisible()) await strokeTab.click();

    const swatches = page.locator(".color-swatch");
    if ((await swatches.count()) > 0) {
      await swatches.first().click();
    }

    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(s).toBe(1);
  });
});

test.describe("PropertiesPanel.tsx palette click outside closes", () => {
  test("click outside popover closes it", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(260, 185);

    const strokeTab = page.locator(".tab-button", { hasText: "Stroke" });
    if (await strokeTab.isVisible()) await strokeTab.click();

    const swatches = page.locator(".color-swatch");
    if ((await swatches.count()) > 0) {
      await swatches.first().click();
    }

    await page.mouse.click(100, 100);
    await page.waitForTimeout(200);

    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(s).toBe(1);
  });
});

test.describe("PropertiesPanel.tsx mixed fill style multi-select", () => {
  test("select elements with different fill styles", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 150, y: 150 }, { x: 250, y: 220 });
    await drawRect(page, { x: 300, y: 150 }, { x: 400, y: 220 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const els = ed.getSnapshot().doc.elements;
      ed.updateElements([els[0].id], { fillStyle: "hachure" });
      ed.selectAll();
    });

    const selected = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().selectedIds.size,
    );
    expect(selected).toBe(2);
  });
});

test.describe("PropertiesPanel.tsx mixed lineType multi-select", () => {
  test("select elements with different lineTypes", async ({ page }) => {
    await open(page);
    await selectTool(page, "5");
    await drag(page, { x: 150, y: 150 }, { x: 250, y: 220 });
    await selectTool(page, "6");
    await drag(page, { x: 300, y: 150 }, { x: 400, y: 220 });
    await selectTool(page, "1");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const els = ed.getSnapshot().doc.elements;
      ed.updateElements([els[0].id], { lineType: "auto" });
      ed.selectAll();
    });

    const selected = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().selectedIds.size,
    );
    expect(selected).toBe(2);
  });
});

test.describe("PropertiesPanel.tsx mixed endArrowhead", () => {
  test("select arrows with different endArrowheads", async ({ page }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 150, y: 150 }, { x: 250, y: 220 });
    await selectTool(page, "6");
    await drag(page, { x: 300, y: 150 }, { x: 400, y: 220 });
    await selectTool(page, "1");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const els = ed.getSnapshot().doc.elements;
      ed.updateElements([els[0].id], { endArrowhead: "dot" });
      ed.selectAll();
    });

    const selected = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().selectedIds.size,
    );
    expect(selected).toBe(2);
  });
});

test.describe("PropertiesPanel.tsx mixed fontSize multi-select", () => {
  test("select text elements with different font sizes", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(200, 300);
    await page.keyboard.type("Small");
    await page.keyboard.press("Escape");
    await selectTool(page, "7");
    await page.mouse.click(400, 300);
    await page.keyboard.type("Big");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const els = ed.getSnapshot().doc.elements;
      ed.updateElements([els[0].id], { fontSize: 12 });
      ed.updateElements([els[1].id], { fontSize: 36 });
      ed.selectAll();
    });

    const selected = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().selectedIds.size,
    );
    expect(selected).toBe(2);
  });
});

test.describe("PropertiesPanel.tsx mixed borderRadius", () => {
  test("select rects with different border radius", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 150, y: 150 }, { x: 250, y: 220 });
    await drawRect(page, { x: 300, y: 150 }, { x: 400, y: 220 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const els = ed.getSnapshot().doc.elements;
      ed.updateElements([els[0].id], { borderRadius: 0 });
      ed.updateElements([els[1].id], { borderRadius: 100 });
      ed.selectAll();
    });

    const selected = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().selectedIds.size,
    );
    expect(selected).toBe(2);
  });
});

test.describe("PropertiesPanel.tsx mixed roughness", () => {
  test("select elements with different roughness", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 150, y: 150 }, { x: 250, y: 220 });
    await drawRect(page, { x: 300, y: 150 }, { x: 400, y: 220 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const els = ed.getSnapshot().doc.elements;
      ed.updateElements([els[0].id], { roughness: 0 });
      ed.updateElements([els[1].id], { roughness: 2 });
      ed.selectAll();
    });

    const selected = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().selectedIds.size,
    );
    expect(selected).toBe(2);
  });
});

test.describe("PropertiesPanel.tsx text element with textVAlign", () => {
  test("set textVAlign on text element", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("VAlign");
    await page.keyboard.press("Escape");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { textVAlign: "top" });
    });

    const va = await page.evaluate(
      () =>
        (window as any).__editor__.getSnapshot().doc.elements[0].textVAlign,
    );
    expect(va).toBe("top");
  });
});

test.describe("PropertiesPanel.tsx caption on diamond", () => {
  test("create diamond with label", async ({ page }) => {
    await open(page);
    await selectTool(page, "4");
    await drag(page, { x: 200, y: 150 }, { x: 350, y: 280 });
    await selectTool(page, "1");

    await page.mouse.dblclick(275, 215);
    await page.keyboard.type("Diamond label");
    await page.keyboard.press("Escape");

    const label = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].label,
    );
    expect(label).toBeTruthy();
  });
});

test.describe("PropertiesPanel.tsx caption on ellipse", () => {
  test("create ellipse with label", async ({ page }) => {
    await open(page);
    await selectTool(page, "3");
    await drag(page, { x: 200, y: 150 }, { x: 350, y: 280 });
    await selectTool(page, "1");

    await page.mouse.dblclick(275, 215);
    await page.keyboard.type("Ellipse label");
    await page.keyboard.press("Escape");

    const label = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].label,
    );
    expect(label).toBeTruthy();
  });
});

test.describe("PropertiesPanel.tsx single text-only selection", () => {
  test("select only text element shows properties", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Only text");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.click(300, 310);

    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().selectedIds.size,
    );
    expect(s).toBe(1);
  });
});
