import { test, expect, open, pressPasteText, importFile, type Page } from "../fixtures";

async function openDocs(page: Page) {
  await page.goto("/docs");
  await page.waitForSelector('[data-testid="docs-page"] .md-root');
}

function extractJsonBlock(
  page: Page,
  required: string[],
  excluded: string[] = [],
) {
  return page.evaluate(
    ({ required, excluded }) => {
      const blocks = Array.from(
        document.querySelectorAll("pre[data-lang=json]"),
      );
      const hit = blocks.find((b) => {
        const text = b.textContent ?? "";
        return (
          required.every((m) => text.includes(m)) &&
          excluded.every((m) => !text.includes(m))
        );
      });
      return hit ? (hit.textContent ?? "") : null;
    },
    { required, excluded },
  );
}

test.describe("docs route", () => {
  test("renders the syntax reference with semantic structure", async ({ page }) => {
    await openDocs(page);

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(/archidraw.*syntax reference/i);
    await expect(page.locator(".docs__link")).toHaveAttribute("href", "/");
    expect(await page.title()).toContain("Syntax Reference");

    expect(await page.locator(".md-table").count()).toBeGreaterThanOrEqual(8);
    expect(await page.locator('pre[data-lang="json"]').count()).toBeGreaterThanOrEqual(8);
    expect(await page.locator("h2").count()).toBeGreaterThanOrEqual(6);
  });

  test("renders a left-side index linking every section heading", async ({ page }) => {
    await openDocs(page);

    const index = page.locator('[data-testid="docs-index"]');
    await expect(index).toBeVisible();

    const headings = page.locator(".docs__body .md-h2, .docs__body .md-h3");
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThanOrEqual(30);

    const links = index.locator("a");
    expect(await links.count()).toBe(headingCount);

    const ids = await headings.evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).id),
    );
    for (const id of ids) {
      expect(id, "every section heading carries an id").not.toHaveLength(0);
    }
    const hrefs = await links.evaluateAll((as) =>
      as.map((a) => a.getAttribute("href")),
    );
    expect(hrefs).toEqual(ids.map((id) => `#${id}`));

    const idxBox = await index.boundingBox();
    const bodyBox = await page.locator(".docs__body").boundingBox();
    expect(idxBox!.x, "menu glued to the left edge").toBe(0);
    expect(idxBox!.x).toBeLessThan(bodyBox!.x);

    // fixed: the menu stays put while the doc scrolls under it
    const yBefore = idxBox!.y;
    const bodyYBefore = bodyBox!.y;
    await page.evaluate(() => {
      document.querySelector(".docs")?.scrollTo({ top: 600, behavior: "instant" });
    });
    expect((await index.boundingBox())!.y).toBe(yBefore);
    expect((await page.locator(".docs__body").boundingBox())!.y).toBeLessThan(
      bodyYBefore,
    );
    await page.evaluate(() => {
      document.querySelector(".docs")?.scrollTo({ top: 0, behavior: "instant" });
    });

    const targetId = ids[10];
    await links.nth(10).click();
    await expect
      .poll(
        () =>
          page.evaluate((id) => {
            const el = document.getElementById(id);
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.top >= 0 && r.top < window.innerHeight;
          }, targetId),
        { timeout: 5000 },
      )
      .toBe(true);
  });

  test("documents every element type, enum and schema marker", async ({ page }) => {
    await openDocs(page);
    const body = await page.locator(".md-root").innerText();

    for (const type of [
      "rectangle",
      "diamond",
      "ellipse",
      "line",
      "arrow",
      "text",
      "component",
      "context",
    ]) {
      expect(body, `element type ${type} documented`).toContain(type);
    }

    for (const value of [
      "archidraw/elements",
      "activeTabId",
      "schemaVersion",
      "dashdot",
      "cross-hachure",
      "hachure",
      "triangle",
      "curved",
      "top-left",
      "internal",
      "external",
      "archidraw:workspace",
    ]) {
      expect(body, `syntax token ${value} documented`).toContain(value);
    }

    for (const field of [
      "strokeColor",
      "backgroundColor",
      "strokeWidth",
      "strokeOpacity",
      "fillOpacity",
      "borderRadius",
      "roughness",
      "labelT",
      "controlPoint",
      "bendPoints",
      "startBinding",
      "endBinding",
      "startArrowhead",
      "endArrowhead",
      "componentId",
      "childIds",
      "labelPosition",
      "labelSide",
      "textVAlign",
      "lineSpacing",
      "captionPosition",
    ]) {
      expect(body, `field ${field} documented`).toContain(field);
    }
  });

  test("documents the .archidraw workspace file format guidance", async ({ page }) => {
    await openDocs(page);
    const body = await page.locator(".md-root").innerText();

    for (const token of [
      "the reference set to copy",
      "Omitting them is safe",
      "Open never recomputes membership",
      "the tab order decides",
      "The box never wraps",
      "sits inside the box",
      "the only place captionPosition applies",
      "bottom-right corner",
      "edges included",
    ]) {
      expect(body, `workspace token ${token} documented`).toContain(token);
    }
  });

  test("documents the .archidrawlib library file format", async ({ page }) => {
    await openDocs(page);
    const body = await page.locator(".md-root").innerText();

    for (const token of [
      ".archidrawlib",
      "libraryItems",
      "roundness",
      "cross-hatch",
      "Invalid library file",
      "fontSize × 0.6 × text.length",
      "smooths the vertices",
      "first point equals the last",
      "Arcs and silhouettes",
      "black fill, no stroke",
      "Tuples and objects may be mixed inside one array",
      "an open contour never fills either",
    ]) {
      expect(body, `library token ${token} documented`).toContain(token);
    }

    await expect(
      page.locator(".md-h3", { hasText: "5.3 Layout and rendering rules" }),
    ).toHaveCount(1);
  });

  test("library file example imports through the library panel", async ({
    page,
  }) => {
    await openDocs(page);
    const json = await extractJsonBlock(page, [
      '"type": "archidrawlib"',
      '"libraryItems"',
      '"name": "Invoke"',
    ]);
    expect(json).toBeTruthy();

    const parsed = JSON.parse(json!);
    expect(parsed.schemaVersion).toBeUndefined();
    expect(parsed.version).toBe(2);
    expect(parsed.libraryItems.length).toBeGreaterThanOrEqual(2);
    for (const item of parsed.libraryItems) {
      expect(typeof item.name).toBe("string");
      expect(item.elements.length).toBeGreaterThan(0);
    }

    await open(page);
    await page.keyboard.press("l");
    await expect(page.locator(".library-panel")).toBeVisible();

    await page.locator('[data-testid="library-import"]').click();
    await page
      .locator(".library-import-input")
      .setInputFiles({
        name: "docs-example.archidrawlib",
        mimeType: "application/json",
        buffer: Buffer.from(json!, "utf8"),
      });

    const group = page.locator('[data-testid="library-imported-group"]');
    await expect(group).toHaveCount(1);
    await expect(group.locator(".library-tile")).toHaveCount(
      parsed.libraryItems.length,
    );

    const svg = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem("archidraw:importedLibraries") || "[]",
      )
        .flatMap((l: { items: { svg: string }[] }) => l.items)
        .map((it: { svg: string }) => it.svg)
        .join("\n"),
    );
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("undefined");
    expect(svg).toContain("<svg");
  });

  test("clipboard envelope example pastes all eight element types", async ({ page, editorState }) => {
    await openDocs(page);
    const json = await extractJsonBlock(page, ['"archidraw/elements"', '"el_ctx"']);
    expect(json).toBeTruthy();

    await open(page);
    expect((await editorState()).elementCount).toBe(0);

    await pressPasteText(page, json!);

    const state = await editorState();
    expect(state.elementCount).toBe(8);
    expect(state.elements.map((e) => e.type).sort()).toEqual([
      "arrow",
      "component",
      "context",
      "diamond",
      "ellipse",
      "line",
      "rectangle",
      "text",
    ]);
    expect(state.selectedIds.length).toBe(8);
  });

  test("bare array and single element examples paste", async ({ page, editorState }) => {
    await openDocs(page);
    const arrayJson = await extractJsonBlock(page, ['"label": "A"', '"label": "B"']);
    const singleJson = await extractJsonBlock(page, ['"text": "hello"']);
    expect(arrayJson).toBeTruthy();
    expect(singleJson).toBeTruthy();

    await open(page);

    await pressPasteText(page, arrayJson!);
    expect((await editorState()).elementCount).toBe(2);

    await pressPasteText(page, singleJson!);
    const state = await editorState();
    expect(state.elementCount).toBe(3);
    expect(state.elements[2].type).toBe("text");
  });

  test("complete workspace example imports as a new diagram", async ({ page, editorState }) => {
    await openDocs(page);
    const json = await extractJsonBlock(page, ['"activeTabId"', '"componentId"']);
    expect(json).toBeTruthy();

    const parsed = JSON.parse(json!);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.tabs).toHaveLength(1);
    const expectedTypes = parsed.tabs[0].doc.elements.map((el: { type: string }) => el.type);
    expect(expectedTypes).toHaveLength(8);

    await open(page);
    const before = await editorState();
    expect(before.tabs).toHaveLength(1);

    await importFile(page, {
      name: "docs-example.archidraw",
      mimeType: "application/json",
      buffer: Buffer.from(json!, "utf8"),
    });

    const state = await editorState();
    expect(state.tabs).toHaveLength(2);
    expect(state.elementCount).toBe(8);
    expect(state.elements.map((e) => e.type)).toEqual(expectedTypes);
    expect(state.elements.map((e) => e.componentId).filter(Boolean)).toEqual(["ec2"]);
  });

  test("minimal and legacy examples are valid JSON for their schemas", async ({ page }) => {
    await openDocs(page);

    const minimal = await extractJsonBlock(page, ['"name": "Minimal"']);
    const legacy = await extractJsonBlock(
      page,
      ['"schemaVersion": 1'],
      ['"activeTabId"', '"archidraw/elements"'],
    );
    expect(minimal).toBeTruthy();
    expect(legacy).toBeTruthy();

    const minimalDoc = JSON.parse(minimal!);
    expect(minimalDoc.schemaVersion).toBe(2);
    expect(minimalDoc.tabs[0].doc.elements).toHaveLength(2);

    const legacyDoc = JSON.parse(legacy!);
    expect(legacyDoc.schemaVersion).toBe(1);
    expect(legacyDoc.doc.elements).toHaveLength(0);
  });
});
