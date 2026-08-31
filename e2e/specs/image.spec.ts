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
  test("Open Image button is present in the toolbar", async ({ page }) => {
    await open(page);
    const imageBtn = page.locator('[aria-label="Open Image"]');
    await expect(imageBtn).toBeVisible();
  });

  test("insertImage adds an image element to the canvas", async ({
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
    expect(state.elements[0].type).toBe("image");
  });

  test("pasting an image from clipboard inserts an image element", async ({
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
    expect(state.elements[0].type).toBe("image");
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
    await selectTool(page, "r");
    await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await selectTool(page, "v");
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
    await page.keyboard.press("Meta+v");

    // só a imagem deve ser inserida — o retângulo copiado NÃO deve duplicar
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__editor__.getSnapshot().doc.elements.map(
            (el: any) => el.type,
          ),
        ),
      )
      .toEqual(["rectangle", "image"]);

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

  test("Style tab of a selected image only offers Opacity", async ({ page }) => {
    await open(page);
    await insertImage(page);

    // no stroke/thickness/fill groups for images
    await expect(page.getByRole("button", { name: "Stroke color Blue" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Thickness 1" })).toHaveCount(0);
    await expect(page.getByRole("slider", { name: "Opacity" })).toBeVisible();
    expect(await panelGroupTitles(page)).toEqual(["Opacity"]);
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
});
