import { type Page, test, expect, open, drag, selectTool } from "../fixtures";

/** inserts a 1x1 red PNG via the editor API and waits for it to be selected */
async function insertImage(page: Page) {
  await page.evaluate(() => {
    const ed = (window as any).__editor__;
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
    const byteStr = atob(pngBase64);
    const arr = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
    const blob = new Blob([arr], { type: "image/png" });
    const file = new File([blob], "test.png", { type: "image/png" });
    ed.insertImage(file);
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__editor__.getSnapshot().doc.elements.length))
    .toBe(1);
  await expect(page.locator(".properties-panel")).toBeVisible();
}

/** group titles of the currently visible tab content */
async function panelGroupTitles(page: Page): Promise<string[]> {
  return page
    .locator(".panel-tab-content:not(.hidden) .panel-subtitle")
    .allTextContents();
}

test.describe("image features", () => {
  test("Import Image button is present in the toolbar", async ({ page }) => {
    await open(page);
    const imageBtn = page.locator('[aria-label="Import Image"]');
    await expect(imageBtn).toBeVisible();
  });

  test("inserted/pasted images are 5x larger (320px) than lib components", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);
    // base de inserção de um componente é 64px; imagens raster entram 5x
    const dims = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { w: e.width, h: e.height };
    });
    expect(dims.w).toBe(320);
    expect(dims.h).toBe(320);
  });

  test("insertImage registers the image as a component and a lib item", async ({
    page,
    editorState,
  }) => {
    await open(page);
    // create a tiny 1x1 red PNG as a data URL and insert via editor API
    const inserted = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      // build a minimal valid PNG (1x1 red pixel)
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
      const byteStr = atob(pngBase64);
      const arr = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
      const blob = new Blob([arr], { type: "image/png" });
      const file = new File([blob], "test.png", { type: "image/png" });
      return new Promise<boolean>((resolve) => {
        // insertImage is async (FileReader + Image onload), so we poll
        ed.insertImage(file);
        const check = setInterval(() => {
          const s = ed.getSnapshot();
          if (s.doc.elements.length > 0) {
            clearInterval(check);
            resolve(true);
          }
        }, 50);
        setTimeout(() => {
          clearInterval(check);
          resolve(false);
        }, 3000);
      });
    });
    expect(inserted).toBe(true);
    const state = await editorState();
    expect(state.elementCount).toBe(1);
    // imagens viram componentes da lib (componentId do grupo Imported)
    expect(state.elements[0].type).toBe("component");
    expect(state.elements[0].componentId).toMatch(/^img-/);
  });

  test("pasting an image from clipboard inserts a component", async ({
    page,
    editorState,
  }) => {
    await open(page);
    // dispatch a paste event with image data
    const inserted = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      // build a minimal valid PNG (1x1 red pixel)
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
      const byteStr = atob(pngBase64);
      const arr = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
      const blob = new Blob([arr], { type: "image/png" });
      const file = new File([blob], "pasted.png", { type: "image/png" });

      // create a DataTransferItem-like object for the clipboard event
      const dt = new DataTransfer();
      dt.items.add(file);
      const event = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
      });
      window.dispatchEvent(event);

      return new Promise<boolean>((resolve) => {
        const check = setInterval(() => {
          const s = ed.getSnapshot();
          if (s.doc.elements.length > 0) {
            clearInterval(check);
            resolve(true);
          }
        }, 50);
        setTimeout(() => {
          clearInterval(check);
          resolve(false);
        }, 3000);
      });
    });
    expect(inserted).toBe(true);
    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].type).toBe("component");
    expect(state.elements[0].componentId).toMatch(/^img-/);
  });

  test("Meta+V with an external image pastes only the image and renders it", async ({
    page,
    context,
  }) => {
    await open(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://localhost:4173",
    });

    // cenário do bug reportado: algo do canvas está copiado no clipboard
    // interno (localStorage) E o clipboard do SO tem uma imagem externa.
    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await selectTool(page, "1");
    await page.mouse.click(150, 140); // seleciona o retângulo
    await page.keyboard.press("Control+c");
    const before = await page.evaluate(
      () => window.__editor__.getSnapshot().doc.elements.length,
    );
    expect(before).toBe(1);

    // coloca uma imagem (1x1 vermelha) no clipboard real do SO
    const wrote = await page.evaluate(async () => {
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
      const byteStr = atob(pngBase64);
      const arr = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++)
        arr[i] = byteStr.charCodeAt(i);
      const blob = new Blob([arr], { type: "image/png" });
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        return true;
      } catch (e) {
        return String(e);
      }
    });
    expect(wrote).toBe(true);

    // real keyboard shortcut — dispatches keydown + native paste event
    // Use synthetic paste event (cross-platform, works in headless CI on Linux
    // where Meta+v does not fire the native paste event)
    await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      const dt = new DataTransfer();
      for (const item of items) {
        for (const type of item.types) {
          const blob = await item.getType(type);
          dt.items.add(
            new File([blob], `paste.${type.split("/")[1]}`, { type }),
          );
        }
      }
      document.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        }),
      );
    });

    // só a imagem deve ser inserida — o retângulo copiado NÃO deve duplicar
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__editor__.getSnapshot().doc.elements.map(
            (el: any) => el.type,
          ),
        ),
      )
      .toEqual(["rectangle", "component"]);

    // aguarda o RAF renderizar a imagem carregada e lê o pixel central
    // (1x1 vermelho) — colado no centro da viewport. Vermelho => renderizou;
    // cinza (#e0e0e0) seria o placeholder do cache não resolvido.
    await page.waitForTimeout(800);
    const centerPx = await page.evaluate(() => {
      const canvas = document.querySelector(".canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      // imagem é inserida no centro da viewport → converte para coords do canvas
      const cx = (window.innerWidth / 2 - rect.left) * dpr;
      const cy = (window.innerHeight / 2 - rect.top) * dpr;
      const { data } = ctx.getImageData(cx, cy, 1, 1);
      return [data[0], data[1], data[2]];
    });
    expect(centerPx[0]).toBeGreaterThan(180);
    expect(centerPx[1]).toBeLessThan(120);
    expect(centerPx[2]).toBeLessThan(120);
  });

  test("Style options of an image match those of a library component", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);

    // imagens viram componentes: o painel de estilo é o MESMO de um item de lib
    const imageTitles = await panelGroupTitles(page);

    await page.evaluate(() => (window as any).__editor__.insertComponent("ec2"));
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__editor__.getSnapshot().doc.elements.at(-1).type,
        ),
      )
      .toBe("component");
    const componentTitles = await panelGroupTitles(page);

    expect(imageTitles).toEqual(componentTitles);
    // nenhum dos dois oferece bordas (reservadas a rectangles)
    expect(imageTitles).not.toContain("Borders");
  });

  test("Text options of an image match those of a library component", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);
    await page.locator(".panel-tab", { hasText: "Text" }).click();
    const imageTitles = await panelGroupTitles(page);
    expect(imageTitles).toEqual([
      "Text color",
      "Size",
      "Family",
      "Style",
      "Line spacing",
      "Caption position",
      "Text offset (px)",
    ]);

    // same list as a component from the library (img de lib)
    await page.evaluate(() => (window as any).__editor__.insertComponent("ec2"));
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__editor__.getSnapshot().doc.elements.at(-1).type,
        ),
      )
      .toBe("component");
    const componentTitles = await panelGroupTitles(page);
    expect(imageTitles).toEqual(componentTitles);
  });

  test("caption of a pasted image renders outside the image (like lib components)", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);

    // image bottom edge in screen coordinates
    const img = await page.evaluate(() => {
      const ed = window.__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const cam = ed.getSnapshot().camera;
      return {
        sx: (el.x + el.width / 2) * cam.zoom + cam.scrollX,
        sy: (el.y + el.height / 2) * cam.zoom + cam.scrollY,
        bottom: (el.y + el.height) * cam.zoom + cam.scrollY,
      };
    });

    // add a label via double-click
    await page.mouse.dblclick(img.sx, img.sy);
    await page.keyboard.type("S3 bucket");
    await page.keyboard.press("Enter");

    // re-open editing: overlay must sit BELOW the image, not over it
    await page.mouse.dblclick(img.sx, img.sy);
    const overlay = page.locator(".text-overlay.label-overlay");
    await expect(overlay).toBeVisible();
    const labelY = await page.evaluate(() => {
      const o = document.querySelector(
        ".text-overlay.label-overlay",
      ) as HTMLElement | null;
      return o ? parseFloat(o.style.top) : null;
    });
    expect(labelY).not.toBeNull();
    // label center (style.top) is placed past the image bottom edge
    expect(labelY!).toBeGreaterThanOrEqual(img.bottom);
  });

  test("editing a pasted image caption starts the caret below the image", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);

    // image bottom edge in screen coordinates
    const img = await page.evaluate(() => {
      const ed = window.__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const cam = ed.getSnapshot().camera;
      return {
        sx: (el.x + el.width / 2) * cam.zoom + cam.scrollX,
        sy: (el.y + el.height / 2) * cam.zoom + cam.scrollY,
        bottom: (el.y + el.height) * cam.zoom + cam.scrollY,
      };
    });

    // double-click on an image WITHOUT a label yet: the edit caret must
    // already sit below the image (where the caption will render), not at
    // the image center
    await page.mouse.dblclick(img.sx, img.sy);
    const overlay = page.locator(".text-overlay.label-overlay");
    await expect(overlay).toBeVisible();

    const overlayTop = await page.evaluate(() => {
      const o = document.querySelector(
        ".text-overlay.label-overlay",
      ) as HTMLElement;
      return parseFloat(o.style.top);
    });
    expect(overlayTop).toBeGreaterThanOrEqual(img.bottom);

    await expect
      .poll(() =>
        page.evaluate(() => {
          const caret = document.querySelector(".fake-caret") as HTMLElement;
          return caret ? parseFloat(caret.style.top) : null;
        }),
      )
      .toBeGreaterThanOrEqual(img.bottom - 1);
  });

  test("caption of a pasted image uses the Text default font (20px sans)", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);

    // a pasted image is born with the same font default as Text (médio + sans)
    const el = await page.evaluate(() => {
      const ed = window.__editor__;
      const e = ed.getSnapshot().doc.elements[0];
      return { fontSize: e.fontSize, fontFamily: e.fontFamily };
    });
    expect(el.fontSize).toBe(20);
    expect(el.fontFamily).toBeUndefined();

    // double-click and type: the caption renders with that font size (20px)
    const center = await page.evaluate(() => {
      const ed = window.__editor__;
      const e = ed.getSnapshot().doc.elements[0];
      const cam = ed.getSnapshot().camera;
      return {
        x: (e.x + e.width / 2) * cam.zoom + cam.scrollX,
        y: (e.y + e.height / 2) * cam.zoom + cam.scrollY,
      };
    });
    await page.mouse.dblclick(center.x, center.y);
    await page.keyboard.type("S3 bucket");

    // while editing, the invisible overlay is set to the caption font (20px)
    const overlayFont = await page.evaluate(() => {
      const overlay = document.querySelector(
        ".text-overlay.label-overlay",
      ) as HTMLElement | null;
      return overlay ? parseFloat(overlay.style.fontSize) : null;
    });
    expect(overlayFont).toBe(20);

    await page.keyboard.press("Enter");

    const after = await page.evaluate(() => {
      const e = window.__editor__.getSnapshot().doc.elements[0];
      return { label: e.label };
    });
    expect(after.label).toBe("S3 bucket");
  });

  test("visual bounds of an image do not expand with its caption", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);

    // get visual bounds WITHOUT any caption
    const boundsNoCaption = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const b = (window as any).__elementVisualBounds__(ctx, el);
      return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 };
    });

    // add a caption
    const center = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const e = ed.getSnapshot().doc.elements[0];
      const cam = ed.getSnapshot().camera;
      return {
        x: (e.x + e.width / 2) * cam.zoom + cam.scrollX,
        y: (e.y + e.height / 2) * cam.zoom + cam.scrollY,
      };
    });
    await page.mouse.dblclick(center.x, center.y);
    await page.keyboard.type("S3 bucket");
    await page.keyboard.press("Escape");

    // get visual bounds WITH caption
    const boundsWithCaption = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const b = (window as any).__elementVisualBounds__(ctx, el);
      return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 };
    });

    // bounds must be identical — caption must not expand the selection box
    expect(boundsWithCaption.x1).toBeCloseTo(boundsNoCaption.x1, 0);
    expect(boundsWithCaption.y1).toBeCloseTo(boundsNoCaption.y1, 0);
    expect(boundsWithCaption.x2).toBeCloseTo(boundsNoCaption.x2, 0);
    expect(boundsWithCaption.y2).toBeCloseTo(boundsNoCaption.y2, 0);
  });

  test("selection of an image excludes its caption (bottom handle grips the image)", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);

    // add a caption below the image via double-click
    const center = await page.evaluate(() => {
      const ed = window.__editor__;
      const e = ed.getSnapshot().doc.elements[0];
      const cam = ed.getSnapshot().camera;
      return {
        x: (e.x + e.width / 2) * cam.zoom + cam.scrollX,
        y: (e.y + e.height / 2) * cam.zoom + cam.scrollY,
      };
    });
    await page.mouse.dblclick(center.x, center.y);
    await page.keyboard.type("S3 bucket");
    await page.keyboard.press("Escape");

    // escape cleared the selection: click the image to re-select it
    await page.mouse.click(center.x, center.y);

    // the bottom-center resize handle sits at the IMAGE bottom edge (not at
    // the caption below it), so dragging it resizes only the image
    const grab = await page.evaluate(() => {
      const ed = window.__editor__;
      const e = ed.getSnapshot().doc.elements[0];
      const cam = ed.getSnapshot().camera;
      return {
        x: (e.x + e.width / 2) * cam.zoom + cam.scrollX,
        y: (e.y + e.height) * cam.zoom + cam.scrollY,
        h: e.height,
        w: e.width,
      };
    });
    await drag(
      page,
      { x: grab.x, y: grab.y },
      { x: grab.x, y: grab.y - 50 },
    );

    const after = await page.evaluate(() => {
      const e = window.__editor__.getSnapshot().doc.elements[0];
      return { w: e.width, h: e.height, label: e.label };
    });
    // only the image shrank — the caption (outside the image) was not resized
    expect(after.h).toBeLessThan(grab.h);
    expect(after.label).toBe("S3 bucket");
  });

  test("imported image appears in the Imported group with a hover-only remove", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);

    await page.keyboard.press("l");
    const group = page.locator('[data-testid="library-imported-images"]');
    await expect(group).toBeVisible();
    // collapsible group like AWS: header + chevron, starts collapsed
    await expect(group.locator(".library-section-header")).toHaveText("Imported");
    await expect(group.locator(".library-section-header")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(group.locator(".library-tile")).toHaveCount(0);

    await group.locator(".library-section-header").click();
    await expect(group.locator(".library-tile")).toHaveCount(1);

    const remove = group.locator(".library-tile-remove");
    await expect(remove).toHaveCount(1);
    await expect(remove).toHaveCSS("opacity", "0");
    await group.locator(".library-tile").hover();
    await expect(remove).toHaveCSS("opacity", "1");
  });

  test("clicking an imported image tile inserts the same component", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await insertImage(page);
    const componentId = (await editorState()).elements[0].componentId;

    await page.keyboard.press("l");
    await page
      .locator('[data-testid="library-imported-images"] .library-section-header')
      .click();
    await page
      .locator('[data-testid="library-imported-images"] .library-tile')
      .click();

    await expect
      .poll(() =>
        page.evaluate(
          () => window.__editor__.getSnapshot().doc.elements.length,
        ),
      )
      .toBe(2);
    const state = await editorState();
    expect(state.elements[1].type).toBe("component");
    expect(state.elements[1].componentId).toBe(componentId);
  });

  test("pasting the same image twice does not duplicate the Imported item", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);
    // insert the SAME image bytes again through the editor API (dedup by src)
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
      const byteStr = atob(pngBase64);
      const arr = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
      const blob = new Blob([arr], { type: "image/png" });
      const file = new File([blob], "test.png", { type: "image/png" });
      ed.insertImage(file);
    });

    // waits for the second element to land (the lib item is already reused)
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__editor__.getSnapshot().doc.elements.length,
        ),
      )
      .toBe(2);

    await page.keyboard.press("l");
    const group = page.locator('[data-testid="library-imported-images"]');
    await group.locator(".library-section-header").click();
    await expect(group.locator(".library-tile")).toHaveCount(1);
    await expect(group.locator(".library-tile-remove")).toHaveCount(1);
  });

  test("removing an image from the Imported group deletes the item", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);

    await page.keyboard.press("l");
    const group = page.locator('[data-testid="library-imported-images"]');
    await group.locator(".library-section-header").click();
    await group.locator(".library-tile").hover();
    await group.locator(".library-tile-remove").click();
    await expect(
      page.locator('[data-testid="library-imported-images"]'),
    ).toHaveCount(0);
  });

  test("removing an image from the lib keeps the placed image on the canvas", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);

    // remove o item do grupo Imported (palette)
    await page.keyboard.press("l");
    const group = page.locator('[data-testid="library-imported-images"]');
    await group.locator(".library-section-header").click();
    await group.locator(".library-tile").hover();
    await group.locator(".library-tile-remove").click();
    await expect(
      page.locator('[data-testid="library-imported-images"]'),
    ).toHaveCount(0);

    // o elemento continua sendo um componente com src autocontido + fill
    const el = await page.evaluate(() => {
      const e = window.__editor__.getSnapshot().doc.elements[0];
      return {
        type: e.type,
        hasSrc: typeof e.src === "string" && e.src.length > 0,
        fill: e.fill,
      };
    });
    expect(el.type).toBe("component");
    expect(el.hasSrc).toBe(true);
    expect(el.fill).toBe(true);

    // e ainda renderiza os pixels (imagem 1x1 vermelha preenche o centro)
    await page.waitForTimeout(500);
    const centerPx = await page.evaluate(() => {
      const canvas = document.querySelector(".canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const cx = (window.innerWidth / 2 - rect.left) * dpr;
      const cy = (window.innerHeight / 2 - rect.top) * dpr;
      const { data } = ctx.getImageData(cx, cy, 1, 1);
      return [data[0], data[1], data[2]];
    });
    expect(centerPx[0]).toBeGreaterThan(180);
    expect(centerPx[1]).toBeLessThan(120);
    expect(centerPx[2]).toBeLessThan(120);
  });

  test("removed lib image still renders after a reload (self-contained src)", async ({
    page,
  }) => {
    await open(page);
    await insertImage(page);

    // remove da lib e salva (autosave)
    await page.keyboard.press("l");
    const group = page.locator('[data-testid="library-imported-images"]');
    await group.locator(".library-section-header").click();
    await group.locator(".library-tile").hover();
    await group.locator(".library-tile-remove").click();
    await page.waitForTimeout(700); // autosave debounce

    await page.reload();
    await open(page);

    const el = await page.evaluate(() => {
      const e = window.__editor__.getSnapshot().doc.elements[0] as any;
      return { type: e.type, hasSrc: !!e.src, fill: e.fill };
    });
    expect(el.type).toBe("component");
    expect(el.hasSrc).toBe(true);
    expect(el.fill).toBe(true);

    await page.waitForTimeout(500);
    const centerPx = await page.evaluate(() => {
      const canvas = document.querySelector(".canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const cx = (window.innerWidth / 2 - rect.left) * dpr;
      const cy = (window.innerHeight / 2 - rect.top) * dpr;
      const { data } = ctx.getImageData(cx, cy, 1, 1);
      return [data[0], data[1], data[2]];
    });
    expect(centerPx[0]).toBeGreaterThan(180);
  });

  test("imported images persist across reloads", async ({ page }) => {
    await open(page);
    await insertImage(page);
    await page.waitForTimeout(700); // autosave debounce

    await page.reload();
    await open(page);
    await page.keyboard.press("l");

    const group = page.locator('[data-testid="library-imported-images"]');
    await expect(group).toBeVisible();
    await group.locator(".library-section-header").click();
    await expect(group.locator(".library-tile")).toHaveCount(1);
  });
});
