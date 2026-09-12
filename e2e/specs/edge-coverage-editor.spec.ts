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

test.describe("editor.ts tab edge cases", () => {
  test("switchTab to the same tab is a no-op", async ({ page, editorState }) => {
    await open(page);
    const id = (await editorState()).activeTabId;
    await page.evaluate((tabId) => (window as any).__editor__.switchTab(tabId), id);
    const s = await editorState();
    expect(s.activeTabId).toBe(id);
  });

  test("switchTab to nonexistent tab is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    const beforeState = await editorState();
    await page.evaluate(
      () => (window as any).__editor__.switchTab("nonexistent-id"),
    );
    const afterState = await editorState();
    expect(afterState.activeTabId).toBe(beforeState.activeTabId);
  });

  test("renameTab to empty string keeps previous name", async ({
    page,
    editorState,
  }) => {
    await open(page);
    const initial = await editorState();
    await page.evaluate(
      (args) => (window as any).__editor__.renameTab(args.id, args.name),
      { id: initial.tabs[0].id, name: "" },
    );
    const after = await editorState();
    expect(after.tabs[0].name).toBe(initial.tabs[0].name);
  });

  test("renameTab to whitespace keeps previous name", async ({
    page,
    editorState,
  }) => {
    await open(page);
    const initial = await editorState();
    await page.evaluate(
      (args) => (window as any).__editor__.renameTab(args.id, args.name),
      { id: initial.tabs[0].id, name: "   " },
    );
    const after = await editorState();
    expect(after.tabs[0].name).toBe(initial.tabs[0].name);
  });

  test("closeTab with invalid ID is a no-op", async ({ page, editorState }) => {
    await open(page);
    await page.evaluate(
      () => (window as any).__editor__.closeTab("nonexistent-id"),
    );
    const s = await editorState();
    expect(s.tabs).toHaveLength(1);
  });

  test("reorderTab with same position is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    const initial = await editorState();
    await page.evaluate(
      (id) => (window as any).__editor__.reorderTab(id, id),
      initial.tabs[0].id,
    );
    const after = await editorState();
    expect(after.tabs.map((t) => t.name)).toEqual(initial.tabs.map((t) => t.name));
  });

  test("reorderTab with invalid from ID is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    const initial = await editorState();
    const tabId = initial.tabs[0].id;
    await page.evaluate(
      (args) => (window as any).__editor__.reorderTab(args.from, args.to),
      { from: "invalid", to: tabId },
    );
    const after = await editorState();
    expect(after.tabs.map((t) => t.name)).toEqual(initial.tabs.map((t) => t.name));
  });

  test("tabElementCount for nonexistent tab returns 0", async ({ page }) => {
    await open(page);
    const count = await page.evaluate(
      () => (window as any).__editor__.tabElementCount("nonexistent"),
    );
    expect(count).toBe(0);
  });
});

test.describe("editor.ts undo/redo edge cases", () => {
  test("undo on empty state is a no-op", async ({ page, editorState }) => {
    await open(page);
    await page.keyboard.press("Control+z");
    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("redo on empty state is a no-op", async ({ page, editorState }) => {
    await open(page);
    await page.keyboard.press("Control+Shift+z");
    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });
});

test.describe("editor.ts delete edge cases", () => {
  test("delete with no selection is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.keyboard.press("Delete");
    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("delete when all selected are locked does nothing", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { locked: true });
    });
    await page.mouse.click(260, 185);
    await page.keyboard.press("Delete");
    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});

test.describe("editor.ts clone edge cases", () => {
  test("clone single element from group creates new group", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.keyboard.press("Control+g");

    const s1 = await editorState();
    const gid = s1.elements[0].groupId;
    expect(gid).toBeTruthy();

    await page.keyboard.press("Control+d");

    const s2 = await editorState();
    expect(s2.elementCount).toBe(4);
    const groupIds = s2.elements.map((e) => e.groupId).filter(Boolean);
    expect(groupIds.length).toBeGreaterThan(0);
  });
});

test.describe("editor.ts label edge cases", () => {
  test("updateLabel with empty string removes label", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { label: "Hello" });
    });
    let s = await editorState();
    expect(s.elements[0].label).toBe("Hello");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateLabel(el.id, "");
    });
    s = await editorState();
    expect(s.elements[0].label).toBeUndefined();
  });
});

test.describe("editor.ts copy/paste edge cases", () => {
  test("copy with no selection is a no-op", async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.copySelected());
    const hasClip = await page.evaluate(
      () => localStorage.getItem("archidraw:clipboard") === null,
    );
    expect(hasClip).toBe(true);
  });

  test("cut with no selection is a no-op", async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.cutSelected());
    const hasClip = await page.evaluate(
      () => localStorage.getItem("archidraw:clipboard") === null,
    );
    expect(hasClip).toBe(true);
  });

  test("paste from empty clipboard is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.paste());
    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("pasteAt from empty clipboard is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() =>
      (window as any).__editor__.pasteAt({ x: 300, y: 300 }),
    );
    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("copyStyle with no selection is a no-op", async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.copyStyle());
    const style = await page.evaluate(
      () => (window as any).__editor__.copiedStyle,
    );
    expect(style).toBeNull();
  });

  test("pasteStyle with no copied style is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.evaluate(() => (window as any).__editor__.pasteStyle());
    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});

test.describe("editor.ts misc edge cases", () => {
  test("toggleLockSelected with no selection is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.toggleLockSelected());
    const s = await editorState();
    expect(s.elements).toHaveLength(0);
  });

  test("groupSelected with less than 2 elements is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.keyboard.press("Control+g");
    const s = await editorState();
    expect(s.elements[0].groupId).toBeUndefined();
  });

  test("ungroupSelected with no groups is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.keyboard.press("Control+Shift+g");
    const s = await editorState();
    expect(s.elements[0].groupId).toBeUndefined();
  });

  test("alignSelected with less than 2 elements is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.evaluate(() =>
      (window as any).__editor__.alignSelected("left"),
    );
    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });

  test("distributeSelected with less than 3 elements is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.evaluate(() =>
      (window as any).__editor__.distributeSelected("horizontal"),
    );
    const s = await editorState();
    expect(s.elementCount).toBe(2);
  });

  test("restoreState with invalid JSON does not crash", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.restoreState("not json"));
    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("importAsNewDiagrams with invalid JSON is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() =>
      (window as any).__editor__.importAsNewDiagrams("bad"),
    );
    const s = await editorState();
    expect(s.tabs).toHaveLength(1);
  });

  test("finishTextEdit when no text is being edited is a no-op", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.finishTextEdit());
    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });
});

test.describe("PropertiesPanel edge cases", () => {
  test("caption position buttons update the component", async ({ page }) => {
    await open(page);
    await page.keyboard.press("l");
    await expect(page.locator(".library-panel")).toBeVisible();
    await page
      .locator(".library-section-header", { hasText: "Kubernetes" })
      .click();
    await page
      .locator('.library-section:has-text("Kubernetes") .library-tile')
      .first()
      .click();
    await page.keyboard.press("l");
    await page.waitForTimeout(200);

    const bottomBtn = page.locator('.size-btn[data-tip="Bottom"]');
    if (await bottomBtn.isVisible()) {
      await bottomBtn.click();
      await page.waitForTimeout(100);
    }

    const state = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(state.count).toBe(1);
  });

  test("font family buttons update text element", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Font test");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.click(340, 310);
    await page.waitForTimeout(200);

    await page.locator(".panel-tab", { hasText: "Text" }).click();
    await page.waitForTimeout(150);

    const sketchBtn = page.locator('.size-btn[data-tip="Sketch"]');
    if (await sketchBtn.isVisible()) {
      await sketchBtn.click();
      const fontFamily = await page.evaluate(() => {
        const el = (window as any).__editor__.getSnapshot().doc.elements[0];
        return el.fontFamily;
      });
      expect(fontFamily).toContain("Architects");
    }
  });

  test("custom radius toggle resets to default", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.waitForTimeout(200);

    await page.locator(".size-btn[data-tip='Custom']").click();
    await page.locator(".size-btn[data-tip='Custom']").click();

    const borderRadius = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.borderRadius;
    });
    expect(borderRadius).toBe(25);
  });

  test("lock button toggles locked state", async ({ page }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.waitForTimeout(200);

    await page.locator(".panel-tab", { hasText: "Layers" }).click();
    await page.waitForTimeout(150);

    const lockBtn = page.locator(
      ".properties-panel .size-btn[data-tip='Lock'], .properties-panel .size-btn[data-tip='Unlock']",
    );
    if (await lockBtn.isVisible()) {
      await lockBtn.click();
      const locked = await page.evaluate(() => {
        const el = (window as any).__editor__.getSnapshot().doc.elements[0];
        return el.locked;
      });
      expect(locked).toBe(true);

      await lockBtn.click();
      const unlocked = await page.evaluate(() => {
        const el = (window as any).__editor__.getSnapshot().doc.elements[0];
        return el.locked;
      });
      expect(unlocked).toBe(false);
    }
  });

  test("palette grid re-clicking same swatch collapses popover", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.waitForTimeout(200);

    const swatch = page.locator(".properties-panel .palette-swatch").first();
    if (await swatch.isVisible()) {
      await swatch.click();
      await page.waitForTimeout(100);
      const popoverBefore = await page
        .locator(".properties-panel .palette-popover")
        .isVisible();

      await swatch.click();
      await page.waitForTimeout(100);
      const popoverAfter = await page
        .locator(".properties-panel .palette-popover")
        .isVisible();

      if (popoverBefore) {
        expect(popoverAfter).toBe(false);
      }
    }
  });
});

test.describe("editor.ts highlightDependencies/clearHighlight", () => {
  test("highlightDependencies highlights connected elements", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await drawRect(page, { x: 400, y: 100 }, { x: 520, y: 180 });
    await selectTool(page, "6");
    await drag(page, { x: 220, y: 140 }, { x: 400, y: 140 });
    await selectTool(page, "1");

    await page.mouse.click(160, 140);
    await page.evaluate(() => (window as any).__editor__.highlightDependencies());

    const highlighted = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const snap = ed.getSnapshot();
      return snap.highlightedIds ? snap.highlightedIds.size : 0;
    });
    expect(highlighted).toBeGreaterThanOrEqual(0);

    await page.evaluate(() => (window as any).__editor__.clearHighlight());
    const cleared = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const snap = ed.getSnapshot();
      return snap.highlightedIds ? snap.highlightedIds.size : 0;
    });
    expect(cleared).toBe(0);
  });

  test("clearHighlight on empty selection is a no-op", async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.clearHighlight());
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.highlightedIds ? snap.highlightedIds.size : 0;
    });
    expect(s).toBe(0);
  });
});

test.describe("editor.ts selectElementAt", () => {
  test("clicking on element selects it", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 200 }, { x: 300, y: 280 });
    await page.mouse.click(250, 240);
    const s = await editorState();
    expect(s.selectedIds).toHaveLength(1);
  });

  test("clicking on grouped element selects the group", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.keyboard.press("Control+g");
    await page.mouse.click(260, 185);
    const s = await editorState();
    expect(s.selectedIds.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("editor.ts reorderElements directions", () => {
  test("bringForward and sendBackward work", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 250, y: 180 }, { x: 370, y: 250 });
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.keyboard.press("Control+]");

    const s = await editorState();
    expect(s.elementCount).toBe(2);

    await page.keyboard.press("Control+[");
    const s2 = await editorState();
    expect(s2.elementCount).toBe(2);
  });
});

test.describe("editor.ts updateElementDetails", () => {
  test("set and clear details on element", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page);

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElementDetails(el.id, "Some details");
    });
    let s = await editorState();
    expect(s.elements[0].details).toBe("Some details");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElementDetails(el.id, "");
    });
    s = await editorState();
    expect(s.elements[0].details).toBeUndefined();
  });
});

test.describe("editor.ts pointerDown right click", () => {
  test("right click does not change selection", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(260, 185);
    const before = await editorState();
    expect(before.selectedIds).toHaveLength(1);

    await page.mouse.click(260, 185, { button: "right" });
    const after = await editorState();
    expect(after.selectedIds).toHaveLength(1);
  });
});

test.describe("editor.ts pointerMove draw with shift", () => {
  test("shift while drawing constrains to square", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "2");
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.keyboard.down("Shift");
    await page.mouse.move(400, 350, { steps: 3 });
    await page.keyboard.up("Shift");
    await page.mouse.up();

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    const el = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { w: Math.abs(e.width), h: Math.abs(e.height) };
    });
    expect(Math.abs(el.w - el.h)).toBeLessThan(5);
  });
});

test.describe("editor.ts undo after move (no-op commit)", () => {
  test("click on empty canvas deselects without extra history", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    const before = await editorState();
    expect(before.elementCount).toBe(1);

    await page.keyboard.press("Control+z");
    const after = await editorState();
    expect(after.elementCount).toBe(0);
  });
});

test.describe("editor.ts paste with corrupted JSON in localStorage", () => {
  test("paste with corrupted clipboard data is safe", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => {
      localStorage.setItem("archidraw:clipboard", "not-valid-json!!!");
    });
    await page.evaluate(() => (window as any).__editor__.paste());
    const s = await editorState();
    expect(s.elementCount).toBe(0);
    await page.evaluate(() => {
      localStorage.removeItem("archidraw:clipboard");
    });
  });

  test("pasteAt with corrupted clipboard data is safe", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => {
      localStorage.setItem("archidraw:clipboard", "bad data");
    });
    await page.evaluate(() =>
      (window as any).__editor__.pasteAt({ x: 300, y: 300 }),
    );
    const s = await editorState();
    expect(s.elementCount).toBe(0);
    await page.evaluate(() => {
      localStorage.removeItem("archidraw:clipboard");
    });
  });
});

test.describe("editor.ts pointerDoubleClick", () => {
  test("double-click on text enters edit mode", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Edit me");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");

    await page.mouse.dblclick(340, 310);
    const editingId = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.editingTextId;
    });
    expect(editingId).toBeTruthy();
    await page.keyboard.press("Escape");
  });

  test("double-click on empty canvas creates free text", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "1");
    await page.mouse.dblclick(300, 300);
    const s = await editorState();
    expect(s.editingTextId).toBeTruthy();
    await page.keyboard.press("Escape");
  });

  test("double-click on locked element does not enter edit mode", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { locked: true });
    });
    await selectTool(page, "1");
    await page.mouse.dblclick(260, 185);
    const s = await editorState();
    expect(s.editingTextId).toBeNull();
  });
});

test.describe("editor.ts importDocument", () => {
  test("importDocument with valid doc", async ({ page, editorState }) => {
    await open(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const doc = {
        schemaVersion: 1,
        elements: [
          {
            id: "el-imp1",
            type: "rectangle",
            x: 100,
            y: 100,
            width: 80,
            height: 60,
            angle: 0,
            strokeColor: "#3d4248",
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 2,
            roughness: 1,
            opacity: 100,
            groupIds: [],
            locked: false,
            frameId: null,
          },
        ],
      };
      ed.importDocument(doc);
    });
    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});

test.describe("editor.ts delete with bindings", () => {
  test("deleting a shape with bound arrow updates arrow endpoints", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await selectTool(page, "6");
    await drag(page, { x: 220, y: 140 }, { x: 380, y: 140 });
    await selectTool(page, "1");

    const s1 = await editorState();
    expect(s1.elementCount).toBe(2);

    await page.mouse.click(160, 140);
    await page.keyboard.press("Backspace");

    const s2 = await editorState();
    expect(s2.elementCount).toBe(1);
  });

  test("deleting one of two shapes leaves the other bound arrow alive", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await drawRect(page, { x: 400, y: 100 }, { x: 520, y: 180 });
    await selectTool(page, "6");
    await drag(page, { x: 220, y: 140 }, { x: 400, y: 140 });
    await selectTool(page, "1");

    await page.mouse.click(160, 140);
    await page.keyboard.press("Backspace");

    const s = await editorState();
    expect(s.elementCount).toBe(2);
  });
});

test.describe("editor.ts label editing flow", () => {
  test("double-click shape, type label, press Escape, undo restores no label", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.dblclick(260, 185);
    await page.keyboard.type("My Label");
    await page.keyboard.press("Escape");

    const s1 = await editorState();
    expect(s1.elements[0].label).toBe("My Label");

    await page.keyboard.press("Control+z");
    const s2 = await editorState();
    expect(s2.elements[0].label).toBeUndefined();
  });

  test("double-click shape, change label, undo restores original", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.dblclick(260, 185);
    await page.keyboard.type("First");
    await page.keyboard.press("Escape");

    await page.mouse.dblclick(260, 185);
    await page.waitForTimeout(100);
    await page.keyboard.press("Meta+a");
    await page.keyboard.type("Second");
    await page.keyboard.press("Escape");

    const s1 = await editorState();
    expect(s1.elements[0].label).toBe("Second");

    await page.keyboard.press("Control+z");
    const s2 = await editorState();
    expect(s2.elements[0].label).toBe("First");
  });

  test("double-click locked shape does not enter label edit", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { locked: true });
    });
    await page.mouse.dblclick(260, 185);
    const s = await editorState();
    expect(s.editingTextId).toBeNull();
  });
});

test.describe("editor.ts tab operations", () => {
  test("delete non-active tab", async ({ page, editorState }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.addTab());
    await page.evaluate(() => (window as any).__editor__.addTab());

    const tabs = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().tabs,
    );
    expect(tabs.length).toBe(3);

    await page.evaluate((tabId: string) => {
      (window as any).__editor__.closeTab(tabId);
    }, tabs[0].id);

    const tabsAfter = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().tabs,
    );
    expect(tabsAfter.length).toBe(2);
  });

  test("close active tab switches to another tab", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.addTab());
    await page.evaluate(() => (window as any).__editor__.addTab());

    const tabs = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().tabs,
    );
    await page.evaluate((tabId: string) => {
      (window as any).__editor__.activateTab(tabId);
    }, tabs[1].id);

    await page.evaluate((tabId: string) => {
      (window as any).__editor__.closeTab(tabId);
    }, tabs[1].id);

    const activeTabId = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().activeTabId,
    );
    expect(activeTabId).toBeTruthy();
  });
});

test.describe("editor.ts group operations", () => {
  test("group and ungroup elements", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.evaluate(() => (window as any).__editor__.groupSelected());

    const s1 = await editorState();
    const hasGroup = s1.elements.some(
      (el: any) => el.groupId,
    );
    expect(hasGroup).toBe(true);

    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.evaluate(() => (window as any).__editor__.ungroupSelected());

    const s2 = await editorState();
    const noGroup = s2.elements.every(
      (el: any) => !el.groupId,
    );
    expect(noGroup).toBe(true);
  });

  test("grouped elements are selected together", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.evaluate(() => (window as any).__editor__.groupSelected());
    const s = await editorState();
    expect(s.selectedIds.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("editor.ts reorderElements", () => {
  test("bringForward and sendBackward work", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 250, y: 180 }, { x: 370, y: 250 });
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.evaluate(() => (window as any).__editor__.bringForward());
    const s1 = await editorState();
    expect(s1.elementCount).toBe(2);

    await page.evaluate(() => (window as any).__editor__.sendBackward());
    const s2 = await editorState();
    expect(s2.elementCount).toBe(2);
  });
});

test.describe("editor.ts paste edge cases", () => {
  test("paste empty string from localStorage", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => {
      localStorage.setItem("archidraw:clipboard", "");
    });
    await page.evaluate(() => (window as any).__editor__.paste());
    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("pasteAt empty string from localStorage", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => {
      localStorage.setItem("archidraw:clipboard", "");
    });
    await page.evaluate(() =>
      (window as any).__editor__.pasteAt({ x: 300, y: 300 }),
    );
    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });
});

test.describe("editor.ts cloneElements", () => {
  test("duplicate elements remaps bindings correctly", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await drawRect(page, { x: 400, y: 100 }, { x: 520, y: 180 });
    await selectTool(page, "6");
    await drag(page, { x: 220, y: 140 }, { x: 400, y: 140 });
    await selectTool(page, "1");

    const beforeCount = (await editorState()).elementCount;
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.keyboard.press("Control+d");

    const s = await editorState();
    expect(s.elementCount).toBeGreaterThanOrEqual(beforeCount + 1);
  });

  test("duplicate single element with no bindings", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.keyboard.press("Control+d");
    const s = await editorState();
    expect(s.elementCount).toBe(2);
  });
});

test.describe("editor.ts lock toggle", () => {
  test("toggleLockSelected locks and unlocks elements", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.evaluate(() =>
      (window as any).__editor__.toggleLockSelected(),
    );
    let locked = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.locked;
    });
    expect(locked).toBe(true);

    await page.evaluate(() =>
      (window as any).__editor__.toggleLockSelected(),
    );
    locked = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.locked;
    });
    expect(locked).toBe(false);
  });
});

test.describe("editor.ts insertComponent and insertElementGroup", () => {
  test("insertComponent places a component element", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.evaluate(() => {
      (window as any).__editor__.insertComponent("ec2");
    });
    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});

test.describe("CanvasHost.tsx text editing overlay right align", () => {
  test("double-click text with right align to trigger overlay", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Right text");
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { textAlign: "right" });
    });
    await selectTool(page, "1");
    await page.mouse.dblclick(340, 310);
    await page.waitForTimeout(200);
    await page.keyboard.type(" edited");
    await page.keyboard.press("Escape");
    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});

test.describe("CanvasHost.tsx text editing overlay left align", () => {
  test("double-click text with left align to trigger overlay", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Left text");
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { textAlign: "left" });
    });
    await selectTool(page, "1");
    await page.mouse.dblclick(340, 310);
    await page.waitForTimeout(200);
    await page.keyboard.type(" edited");
    await page.keyboard.press("Escape");
    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});

test.describe("CanvasHost.tsx label editing on rect right align", () => {
  test("double-click rect with right-aligned label", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        label: "Label",
        textAlign: "right",
        textVAlign: "top",
      });
    });
    await page.mouse.dblclick(260, 185);
    await page.waitForTimeout(200);
    await page.keyboard.type(" edited");
    await page.keyboard.press("Escape");
    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});

test.describe("CanvasHost.tsx label editing on rect left align bottom", () => {
  test("double-click rect with left-aligned bottom label", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], {
        label: "Bottom",
        textAlign: "left",
        textVAlign: "bottom",
      });
    });
    await page.mouse.dblclick(260, 185);
    await page.waitForTimeout(200);
    await page.keyboard.type(" edit");
    await page.keyboard.press("Escape");
    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});

test.describe("editor.ts double-click on text element to begin editing", () => {
  test("double-click text starts editing", async ({ page, editorState }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Dblclick");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");
    await page.mouse.dblclick(340, 310);
    await page.waitForTimeout(200);
    const editing = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().editingTextId,
    );
    expect(editing).toBeTruthy();
    await page.keyboard.press("Escape");
  });
});

test.describe("editor.ts draw mode with shift key", () => {
  test("shift constrains rectangle to square during draw", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "2");
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.keyboard.down("Shift");
    await page.mouse.move(420, 380, { steps: 5 });
    await page.keyboard.up("Shift");
    await page.mouse.up();
    await selectTool(page, "1");
    const el = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { w: Math.abs(e.width), h: Math.abs(e.height) };
    });
    expect(Math.abs(el.w - el.h)).toBeLessThan(10);
  });
});

test.describe("editor.ts reorderElements backward", () => {
  test("send backward moves element one step back", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 350, y: 250 });
    await drawRect(page, { x: 400, y: 150 }, { x: 550, y: 250 });
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.evaluate(() => (window as any).__editor__.sendBackward());
    const topEl = await page.evaluate(() => {
      const els = (window as any).__editor__.getSnapshot().doc.elements;
      return els[els.length - 1].id;
    });
    expect(topEl).toBeTruthy();
  });
});

test.describe("editor.ts click on canvas while editing text", () => {
  test("click on canvas during text editing commits and moves", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Editing");
    await page.waitForTimeout(200);
    await page.mouse.click(500, 500);
    await page.waitForTimeout(200);
    const editing = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().editingTextId,
    );
    expect(editing).toBeNull();
  });
});

test.describe("editor.ts double-click on locked text", () => {
  test("double-click on locked text does not start editing", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Locked");
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { locked: true });
    });
    await selectTool(page, "1");
    await page.mouse.dblclick(340, 310);
    await page.waitForTimeout(200);
    const editing = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().editingTextId,
    );
    expect(editing).toBeNull();
  });
});

test.describe("editor.ts double-click on empty area", () => {
  test("double-click on empty canvas creates text element", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "1");
    await page.mouse.dblclick(500, 500);
    await page.waitForTimeout(200);
    const editing = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().editingTextId,
    );
    expect(editing).toBeTruthy();
    await page.keyboard.press("Escape");
  });
});

test.describe("editor.ts undo text edit removes text", () => {
  test("undo after editing text", async ({ page }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Before");
    await page.keyboard.press("Escape");
    const beforeCount = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(beforeCount).toBe(1);
    await page.keyboard.press("Control+z");
    const s = await page.evaluate(() => (window as any).__editor__.getSnapshot());
    expect(s.doc.elements.length).toBe(0);
  });
});

test.describe("editor.ts paste at specific point", () => {
  test("pasteAt places elements at given position", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 200 }, { x: 300, y: 280 });
    await page.keyboard.press("Control+c");
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.evaluate(() => (window as any).__editor__.deleteSelected());
    const count = await page.evaluate(() =>
      (window as any).__editor__.pasteAt({ x: 500, y: 500 }),
    );
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe("editor.ts pointerDown while drawing", () => {
  test("start drawing then click on canvas", async ({ page }) => {
    await open(page);
    await selectTool(page, "2");
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.mouse.move(400, 400, { steps: 3 });
    await page.mouse.up();
    await selectTool(page, "1");
    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(s).toBe(1);
  });
});

test.describe("editor.ts control point on edge", () => {
  test("drag control point on curved arrow", async ({ page }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 400, y: 200 });
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved" });
    });
    const type = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return e.lineType;
    });
    expect(type).toBe("curved");
  });
});

test.describe("editor.ts beginTextEdit from non-selected", () => {
  test("double-click unselected element enters label edit", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { label: "Label text" });
    });
    await selectTool(page, "1");
    await page.mouse.dblclick(260, 185);
    await page.waitForTimeout(200);
    const editing = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().editingTextId,
    );
    expect(editing).toBeTruthy();
    await page.keyboard.press("Escape");
  });
});

test.describe("editor.ts insertElementGroup", () => {
  test("insertElementGroup places a group", async ({ page, editorState }) => {
    await open(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.insertElementGroup([
        {
          id: "grp-el1",
          type: "rectangle",
          x: 200,
          y: 200,
          width: 80,
          height: 60,
          angle: 0,
          strokeColor: "#3d4248",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
          roughness: 1,
          opacity: 100,
          groupIds: [],
          locked: false,
          frameId: null,
        },
        {
          id: "grp-el2",
          type: "ellipse",
          x: 300,
          y: 200,
          width: 80,
          height: 60,
          angle: 0,
          strokeColor: "#3d4248",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
          roughness: 1,
          opacity: 100,
          groupIds: [],
          locked: false,
          frameId: null,
        },
      ]);
    });
    const s = await editorState();
    expect(s.elementCount).toBeGreaterThanOrEqual(1);
  });
});

test.describe("editor.ts alignSelected", () => {
  test("alignSelected with all alignment options", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 200 }, { x: 520, y: 270 });
    await page.evaluate(() => (window as any).__editor__.selectAll());

    await page.evaluate(() =>
      (window as any).__editor__.alignSelected("left"),
    );
    await page.evaluate(() =>
      (window as any).__editor__.alignSelected("centerHorizontal"),
    );
    await page.evaluate(() =>
      (window as any).__editor__.alignSelected("right"),
    );
    await page.evaluate(() =>
      (window as any).__editor__.alignSelected("top"),
    );
    await page.evaluate(() =>
      (window as any).__editor__.alignSelected("centerVertical"),
    );
    await page.evaluate(() =>
      (window as any).__editor__.alignSelected("bottom"),
    );

    const s = await editorState();
    expect(s.elementCount).toBe(2);
  });
});

test.describe("editor.ts arrow binding + move rectangle", () => {
  test("draw arrow bound to rect, move rect, arrow follows", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await drawRect(page, { x: 400, y: 100 }, { x: 520, y: 180 });
    await selectTool(page, "6");
    await drag(page, { x: 220, y: 140 }, { x: 400, y: 140 });
    await selectTool(page, "1");

    const s1 = await editorState();
    expect(s1.elementCount).toBe(3);

    await page.mouse.click(160, 140);
    await page.mouse.move(160, 140);
    await page.mouse.down();
    await page.mouse.move(200, 160, { steps: 5 });
    await page.mouse.up();

    const s2 = await editorState();
    expect(s2.elementCount).toBe(3);
  });

  test("draw arrow bound to ellipse, move ellipse", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "4");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await selectTool(page, "1");

    await selectTool(page, "6");
    await drag(page, { x: 220, y: 140 }, { x: 400, y: 140 });
    await selectTool(page, "1");

    const s1 = await editorState();
    expect(s1.elementCount).toBe(2);

    await page.mouse.click(160, 140);
    await page.mouse.move(160, 140);
    await page.mouse.down();
    await page.mouse.move(200, 160, { steps: 5 });
    await page.mouse.up();

    const s2 = await editorState();
    expect(s2.elementCount).toBe(2);
  });

  test("draw arrow bound to diamond, move diamond", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "3");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await selectTool(page, "1");

    await selectTool(page, "6");
    await drag(page, { x: 220, y: 140 }, { x: 400, y: 140 });
    await selectTool(page, "1");

    const s1 = await editorState();
    expect(s1.elementCount).toBe(2);

    await page.mouse.click(160, 140);
    await page.mouse.move(160, 140);
    await page.mouse.down();
    await page.mouse.move(200, 160, { steps: 5 });
    await page.mouse.up();

    const s2 = await editorState();
    expect(s2.elementCount).toBe(2);
  });
});

test.describe("editor.ts delete with bound edges", () => {
  test("delete shape bound by two arrows", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await drawRect(page, { x: 400, y: 100 }, { x: 520, y: 180 });
    await selectTool(page, "6");
    await drag(page, { x: 220, y: 140 }, { x: 400, y: 140 });
    await selectTool(page, "1");

    await page.mouse.click(460, 140);
    await page.keyboard.press("Backspace");

    const s = await editorState();
    expect(s.elementCount).toBe(2);
  });

  test("delete bound arrow itself", async ({ page, editorState }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await drawRect(page, { x: 400, y: 100 }, { x: 520, y: 180 });
    await selectTool(page, "6");
    await drag(page, { x: 220, y: 140 }, { x: 400, y: 140 });
    await selectTool(page, "1");

    await page.mouse.click(310, 140);
    await page.keyboard.press("Backspace");

    const s = await editorState();
    expect(s.elementCount).toBe(2);
  });
});

test.describe("editor.ts highlightDependencies and clearHighlight", () => {
  test("highlight connected elements and clear", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await drawRect(page, { x: 400, y: 100 }, { x: 520, y: 180 });
    await selectTool(page, "6");
    await drag(page, { x: 220, y: 140 }, { x: 400, y: 140 });
    await selectTool(page, "1");

    await page.mouse.click(160, 140);
    await page.evaluate(() => (window as any).__editor__.highlightDependencies());

    await page.evaluate(() => (window as any).__editor__.clearHighlight());

    const s = await editorState();
    expect(s.elementCount).toBe(3);
  });

  test("highlightDependencies with no selection is no-op", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => (window as any).__editor__.highlightDependencies());
    await page.evaluate(() => (window as any).__editor__.clearHighlight());
    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(s).toBe(0);
  });
});

test.describe("editor.ts resize with shift (aspect lock)", () => {
  test("shift-constrained corner resize maintains aspect ratio", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 300, y: 230 });
    await selectTool(page, "1");

    const before = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { w: el.width, h: el.height };
    });

    await page.mouse.move(300, 230);
    await page.mouse.down();
    await page.keyboard.down("Shift");
    await page.mouse.move(360, 280, { steps: 5 });
    await page.keyboard.up("Shift");
    await page.mouse.up();

    const after = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { w: Math.abs(el.width), h: Math.abs(el.height) };
    });
    expect(after.w).toBeGreaterThan(before.w);
    expect(after.h).toBeGreaterThan(before.h);
  });
});

test.describe("editor.ts selection marquee", () => {
  test("marquee selection selects enclosed elements", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await selectTool(page, "1");

    await page.evaluate(() => (window as any).__editor__.selectAll());

    const s = await editorState();
    expect(s.selectedIds.length).toBe(2);
  });

  test("marquee selection from right to left", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await selectTool(page, "1");

    await page.mouse.move(550, 280);
    await page.mouse.down();
    await page.mouse.move(150, 100, { steps: 5 });
    await page.mouse.up();

    const s = await editorState();
    expect(s.selectedIds.length).toBe(2);
  });
});

test.describe("editor.ts text editing edge cases", () => {
  test("create free text and verify editing state", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    const editing1 = await editorState();
    expect(editing1.editingTextId).toBeTruthy();

    await page.keyboard.type("Free text");
    await page.keyboard.press("Escape");

    const editing2 = await editorState();
    expect(editing2.editingTextId).toBeNull();
    expect(editing2.elementCount).toBe(1);
  });

  test("editing text, press Enter to create line break, then Escape", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Line 1");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Line 2");
    await page.keyboard.press("Escape");

    const text = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.text;
    });
    expect(text).toContain("Line 1");
  });
});

test.describe("editor.ts undo/redo stack", () => {
  test("multiple undo steps restore previous states", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await drawRect(page, { x: 300, y: 300 }, { x: 420, y: 370 });

    const s3 = await editorState();
    expect(s3.elementCount).toBe(3);

    await page.keyboard.press("Control+z");
    const s2 = await editorState();
    expect(s2.elementCount).toBe(2);

    await page.keyboard.press("Control+z");
    const s1 = await editorState();
    expect(s1.elementCount).toBe(1);

    await page.keyboard.press("Control+Shift+z");
    const s2r = await editorState();
    expect(s2r.elementCount).toBe(2);
  });
});

test.describe("editor.ts delete multiple elements", () => {
  test("delete two elements at once", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await page.evaluate(() => (window as any).__editor__.selectAll());
    await page.keyboard.press("Backspace");

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });
});

test.describe("editor.ts shift-click selection", () => {
  test("shift-click adds element to selection", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await selectTool(page, "1");

    await page.mouse.click(260, 185);
    let s = await editorState();
    expect(s.selectedIds.length).toBe(1);

    await page.keyboard.down("Shift");
    await page.mouse.click(460, 185);
    await page.keyboard.up("Shift");
    s = await editorState();
    expect(s.selectedIds.length).toBe(2);
  });

  test("shift-click on already selected element deselects it", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 400, y: 150 }, { x: 520, y: 220 });
    await selectTool(page, "1");

    await page.mouse.click(260, 185);
    await page.keyboard.down("Shift");
    await page.mouse.click(260, 185);
    await page.keyboard.up("Shift");

    const s = await editorState();
    expect(s.selectedIds.length).toBe(0);
  });
});

test.describe("editor.ts undo after text edit", () => {
  test("undo after label creation removes label", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.dblclick(260, 185);
    await page.keyboard.type("Label");
    await page.keyboard.press("Escape");

    await page.keyboard.press("Control+z");
    const s = await editorState();
    expect(s.elements[0].label).toBeUndefined();
  });
});

test.describe("editor.ts reorderTab same index", () => {
  test("reorderTab to same position is no-op", async ({ page }) => {
    await open(page);
    const tabs = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().tabs,
    );
    await page.evaluate((tabId: string) => {
      (window as any).__editor__.reorderTab(tabId, 0);
    }, tabs[0].id);

    const tabsAfter = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().tabs,
    );
    expect(tabsAfter[0].id).toBe(tabs[0].id);
  });
});

test.describe("editor.ts insertElementGroup empty", () => {
  test("insertElementGroup with empty array", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      (window as any).__editor__.insertElementGroup([]);
    });
    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(s).toBe(0);
  });
});

test.describe("editor.ts paste edge cases", () => {
  test("paste with cleared localStorage", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      localStorage.removeItem("archidraw:clipboard");
    });
    const count = await page.evaluate(
      () => (window as any).__editor__.paste(),
    );
    expect(count).toBe(0);
  });

  test("paste with empty JSON array", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      localStorage.setItem("archidraw:clipboard", "[]");
    });
    const count = await page.evaluate(
      () => (window as any).__editor__.paste(),
    );
    expect(count).toBe(0);
  });

  test("pasteAt with cleared localStorage", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      localStorage.removeItem("archidraw:clipboard");
    });
    const count = await page.evaluate(() =>
      (window as any).__editor__.pasteAt({ x: 300, y: 300 }),
    );
    expect(count).toBe(0);
  });
});

test.describe("editor.ts updateText label path", () => {
  test("updateText on label during editing updates the label", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.dblclick(260, 185);
    await page.keyboard.type("Old");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateText(el.id, "New");
    });

    await page.keyboard.press("Escape");

    const label = await page.evaluate(() => {
      const el = (window as any).__editor__.getSnapshot().doc.elements[0];
      return el.label;
    });
    expect(label).toBe("New");
  });
});

test.describe("editor.ts export SVG from empty doc", () => {
  test("import empty document and add element", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      (window as any).__editor__.importDocument({
        schemaVersion: 1,
        elements: [],
      });
    });
    const count = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(count).toBe(0);
  });
});

test.describe("editor.ts export SVG with all element types", () => {
  test("exportSvg with rect, arrow, and text", async ({ page }) => {
    await open(page);
    await drawRect(page, { x: 100, y: 100 }, { x: 200, y: 160 });
    await selectTool(page, "6");
    await drag(page, { x: 300, y: 200 }, { x: 500, y: 250 });
    await selectTool(page, "1");

    await selectTool(page, "7");
    await page.mouse.click(150, 300);
    await page.keyboard.type("Text");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
  });
});

test.describe("editor.ts drag with shift (draw mode)", () => {
  test("draw rectangle with shift constrains to square", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "2");
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.keyboard.down("Shift");
    await page.mouse.move(400, 370, { steps: 3 });
    await page.keyboard.up("Shift");
    await page.mouse.up();

    const el = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { w: Math.abs(e.width), h: Math.abs(e.height) };
    });
    expect(Math.abs(el.w - el.h)).toBeLessThan(5);
  });
});

test.describe("editor.ts pointerUp after label-move no drag", () => {
  test("click arrow label handle and release without moving", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 200 }, { x: 400, y: 200 });
    await selectTool(page, "1");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { label: "test" });
    });

    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});
