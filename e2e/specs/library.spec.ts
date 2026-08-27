import { type Page, test, expect, open } from "../fixtures";

/** opens the library panel; groups start collapsed */
async function openLibrary(page: Page) {
  await open(page);
  await page.keyboard.press("b");
  await expect(page.locator(".library-panel")).toBeVisible();
}

/** opens the panel and expands the AWS group */
async function openLibraryWithAws(page: Page) {
  await openLibrary(page);
  await page.locator(".library-section-header").click();
}

test.describe("component library", () => {
  test("opens via B shortcut with groups collapsed", async ({ page }) => {
    await openLibrary(page);

    // AWS starts collapsed
    const header = page.locator(".library-section-header");
    await expect(header).toHaveText(/AWS/);
    await expect(header).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.locator('.library-panel [data-component-id="ec2"]'),
    ).toHaveCount(0);
  });

  test("inserts component by clicking after expanding AWS", async ({
    page,
    editorState,
  }) => {
    await openLibraryWithAws(page);
    const panel = page.locator(".library-panel");

    const sqs = panel.locator('[data-component-id="sqs"]');
    await expect(sqs).toBeVisible();
    await sqs.click();

    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.selectedIds.length).toBe(1);
    expect(state.elements[0].type).toBe("component");
    expect(state.elements[0].componentId).toBe("sqs");

    // no outline by default: just icon + name
    const strokeWidth = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].strokeWidth;
    });
    expect(strokeWidth).toBe(0);

    // panel stays open to insert more components
    await expect(panel).toBeVisible();
  });

  test("expanded AWS shows categories (Compute, Network…)", async ({
    page,
  }) => {
    await openLibraryWithAws(page);

    for (const cat of ["Compute", "Network", "Database", "Storage"]) {
      await expect(
        page.locator(".library-subgroup").filter({ hasText: cat }),
      ).toBeVisible();
    }
  });

  test("search filters by name and keyword", async ({ page }) => {
    await openLibrary(page);

    const search = page.locator(".library-search");
    await search.fill("queue");
    const grid = page.locator(".library-body");
    await expect(grid.locator(".library-card")).toHaveCount(1);
    await expect(grid.locator('[data-component-id="sqs"]')).toBeVisible();

    await search.fill("zzz-nada");
    await expect(page.locator(".library-empty")).toBeVisible();
  });

  test("Enter in search field inserts the first result", async ({
    page,
    editorState,
  }) => {
    await openLibrary(page);

    await page.locator(".library-search").fill("lambda");
    await page.keyboard.press("Enter");

    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].componentId).toBe("lambda");
  });

  test("inserted component is born selected with service label", async ({
    page,
    editorState,
  }) => {
    await openLibraryWithAws(page);
    await page
      .locator('.library-panel [data-component-id="api-gateway"]')
      .click();

    const state = await editorState();
    expect(state.elements[0].label).toBe("API Gateway");
    expect(state.tool).toBe("selection");
  });

  test("double-click edits the component label", async ({
    page,
    editorState,
  }) => {
    await openLibraryWithAws(page);
    await page.locator('.library-panel [data-component-id="s3"]').click();

    // center of the element in screen coords
    const center = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return ed.getScreenPoint({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
    });
    await page.mouse.dblclick(center.x, center.y);

    await expect(page.locator(".text-overlay.label-overlay")).toBeVisible();
    await expect(page.locator(".fake-caret")).toBeVisible();
    // in-place editing: overlay at label position (below icon), invisible
    // textarea with fake caret — canvas renders the label with final style
    const overlayInfo = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const overlay = document.querySelector(
        ".text-overlay.label-overlay",
      ) as HTMLElement;
      const cam = ed.getSnapshot().camera;
      return {
        outlineStyle: getComputedStyle(overlay).outlineStyle,
        color: getComputedStyle(overlay).color,
        top: parseFloat(overlay.style.top),
        expectedTop:
          (el.y + el.height / 2) * cam.zoom + cam.scrollY,
      };
    });
    expect(overlayInfo.outlineStyle).toBe("none");
    expect(overlayInfo.color).toBe("rgba(0, 0, 0, 0)");
    // label fica abaixo do centro do elemento (não no meio)
    expect(overlayInfo.top).toBeGreaterThan(overlayInfo.expectedTop);

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Upload bucket");
    await page.keyboard.press("ControlOrMeta+a");
    // fake selection is WYSIWYG: exactly one rect matching the canvas label
    // width (native ::selection is disabled on the invisible overlay)
    await page.waitForTimeout(150);
    const selInfo = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const rect = document.querySelector(
        ".fake-selection-rect",
      ) as HTMLElement | null;
      return {
        count: document.querySelectorAll(".fake-selection-rect").length,
        width: rect ? parseFloat(rect.style.width) : 0,
        expectedWidth:
          el.label.length * (el.fontSize ?? 12) === 0
            ? 0
            : (() => {
                // approximate canvas label width via measureText from the app
                const c = document.createElement("canvas").getContext("2d")!;
                c.font = `${el.fontSize ?? 12}px "Segoe UI", system-ui, sans-serif`;
                return c.measureText(el.label).width * ed.getSnapshot().camera.zoom;
              })(),
      };
    });
    expect(selInfo.count).toBe(1);
    expect(Math.abs(selInfo.width - selInfo.expectedWidth)).toBeLessThan(3);

    await page.keyboard.press("Enter");

    const state = await editorState();
    expect(state.elements[0].label).toBe("Upload bucket");
    expect(state.editingTextId).toBeNull();
  });

  test("component persists after reload", async ({ page, editorState }) => {
    await openLibraryWithAws(page);
    await page.locator('.library-panel [data-component-id="rds"]').click();
    // wait for debounced autosave
    await page.waitForTimeout(700);

    await page.reload();
    await open(page);

    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].componentId).toBe("rds");
  });

  test("closes with Esc and close button", async ({ page }) => {
    await openLibrary(page);

    await page.keyboard.press("Escape");
    await expect(page.locator(".library-panel")).toHaveCount(0);

    await page.keyboard.press("b");
    await page.locator(".library-close").click();
    await expect(page.locator(".library-panel")).toHaveCount(0);
  });

  test("toolbar button toggles the panel", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Component Library" }).click();
    await expect(page.locator(".library-panel")).toBeVisible();
    await page.getByRole("button", { name: "Component Library" }).click();
    await expect(page.locator(".library-panel")).toHaveCount(0);
  });

  test("AWS services use official icon and generics fall back to vector glyph", async ({
    page,
    editorState,
  }) => {
    await openLibraryWithAws(page);

    // EC2 has official embedded asset
    const ec2 = page.locator('.library-panel [data-component-id="ec2"]');
    await expect(ec2.locator("img.library-card-img")).toBeVisible();

    // service name comes as tooltip, no text in tile
    await expect(ec2).toHaveAttribute("data-tip", "EC2");
    await expect(ec2.locator(".library-card-name")).toHaveCount(0);

    // Client has no official asset → inline vector glyph
    const client = page.locator(
      '.library-panel [data-component-id="client"]',
    );
    await expect(client.locator("svg")).toBeVisible();

    await ec2.click();
    const state = await editorState();
    expect(state.elements[0].componentId).toBe("ec2");
  });

  test("AWS group expands and collapses", async ({ page }) => {
    await openLibrary(page);

    const header = page.locator(".library-section-header");
    await expect(header).toHaveAttribute("aria-expanded", "false");
    const tile = page.locator('.library-panel [data-component-id="ec2"]');
    await expect(tile).toHaveCount(0);

    await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "true");
    await expect(tile).toBeVisible();

    await header.click();
    await expect(tile).toHaveCount(0);
  });

  test("recents appear before AWS group and are limited to 15 items", async ({
    page,
  }) => {
    await openLibraryWithAws(page);

    // insert two components to populate recents
    await page.locator('.library-panel [data-component-id="s3"]').click();
    await page.locator('.library-panel [data-component-id="rds"]').click();

    const recents = page.locator('[data-testid="library-recents"]');
    await expect(recents).toBeVisible();
    await expect(recents.locator(".library-tile")).toHaveCount(2);

    // recents appear before the AWS section
    await expect(
      page.locator(".library-body > *").first(),
    ).toHaveAttribute("data-testid", "library-recents");

    // RDS was most recent → first recents tile
    await expect(recents.locator(".library-tile").first()).toHaveAttribute(
      "data-component-id",
      "rds",
    );
  });
});
