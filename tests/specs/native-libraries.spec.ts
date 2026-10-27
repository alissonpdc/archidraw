import { type Page, test, expect, open } from "../fixtures";

async function openLibrary(page: Page) {
  await open(page);
  await page.keyboard.press("l");
  await expect(page.locator(".library-panel")).toBeVisible();
}

test.describe("native system design libraries", () => {
  test("shows 5 native library sections with converted names, initially collapsed", async ({
    page,
  }) => {
    await openLibrary(page);

    const expectedTitles = [
      "Clients & Personas",
      "Infrastructure & Network",
      "Compute & Services",
      "Messaging & Integration",
      "Data & Storage",
    ];

    for (const title of expectedTitles) {
      const header = page.locator(".library-section-header", { hasText: title });
      await expect(header).toBeVisible();
      await expect(header).toHaveAttribute("aria-expanded", "false");
    }
  });

  test("renders library sections in order: AWS, GCP, Azure, Clients & Personas, etc.", async ({
    page,
  }) => {
    await openLibrary(page);

    const headers = page.locator(".library-section-header");
    const titles = (await headers.allTextContents()).map((t) => t.trim());

    expect(titles.slice(0, 5)).toEqual([
      "AWS",
      "GCP",
      "Azure",
      "Clients & Personas",
      "Infrastructure & Network",
    ]);
  });

  test("expands Clients & Personas and displays all 10 components", async ({
    page,
  }) => {
    await openLibrary(page);

    const header = page.locator(".library-section-header", {
      hasText: "Clients & Personas",
    });
    await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "true");

    const expectedComponents = [
      "User",
      "Users",
      "Developer",
      "Admin",
      "Mobile App",
      "Web Browser",
      "Browser",
      "Smartphone",
      "Search Engine",
      "Tablet",
    ];

    for (const name of expectedComponents) {
      const tile = page.locator(`.library-panel [data-tip="${name}"]`);
      await expect(tile).toBeVisible();
    }
  });

  test("clicking a native library component inserts editable elements on canvas", async ({
    page,
    editorState,
  }) => {
    await openLibrary(page);

    const header = page.locator(".library-section-header", {
      hasText: "Clients & Personas",
    });
    await header.click();

    const userTile = page.locator('.library-panel [data-tip="User"]');
    await expect(userTile).toBeVisible();
    await userTile.click();

    const state = await editorState();
    // User component consists of 3 elements: head, torso, text caption
    expect(state.elementCount).toBe(3);
    expect(state.selectedIds.length).toBe(3);
  });

  test("clicking a newly added client component inserts it with caption", async ({
    page,
    editorState,
  }) => {
    await openLibrary(page);

    const header = page.locator(".library-section-header", {
      hasText: "Clients & Personas",
    });
    await header.click();

    const phoneTile = page.locator('.library-panel [data-tip="Smartphone"]');
    await expect(phoneTile).toBeVisible();
    await phoneTile.click();

    const state = await editorState();
    // Smartphone component consists of 6 elements: 5 shape elements + 1 caption
    expect(state.elementCount).toBe(6);
    expect(state.selectedIds.length).toBe(6);
    expect(state.elements.some((el) => el.type === "text")).toBe(true);

    const hasCaption = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements.some((el: any) => el.type === "text" && el.text === "Smartphone");
    });
    expect(hasCaption).toBe(true);
  });

  test("native library components are searchable", async ({ page }) => {
    await openLibrary(page);

    const search = page.locator(".library-search");
    await search.fill("Rate Limiter");

    const grid = page.locator(".library-body");
    await expect(grid.locator('[data-tip="Rate Limiter"]')).toBeVisible();
  });

  test("native libraries do not have a remove button", async ({ page }) => {
    await openLibrary(page);

    const section = page.locator('[data-testid="library-native-clients-personas"]');
    await expect(section.locator(".library-group-remove")).toHaveCount(0);
  });
});
