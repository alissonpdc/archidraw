import { test, expect, open, drag, selectTool } from "../fixtures";

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
});
