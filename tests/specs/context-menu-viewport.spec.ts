import { test, expect, open, drag, selectTool } from "../fixtures";
import type { Locator, Page } from "@playwright/test";

/**
 * Distance every context-menu box must keep from the viewport edges.
 * One pixel of tolerance absorbs the rounding of the layout box.
 */
const EDGE_GAP = 7;

/** gap between a box and each viewport edge, `null` while it is not rendered */
async function edgeGaps(page: Page, target: Locator) {
  const vp = page.viewportSize();
  const box = await target.boundingBox();
  if (!vp || !box) return null;
  return {
    top: box.y,
    left: box.x,
    bottom: vp.height - (box.y + box.height),
    right: vp.width - (box.x + box.width),
  };
}

/**
 * The menu animates in for 140ms with a scale/slide, so its box is polled
 * until it settles instead of read once right after the click/hover.
 */
async function expectEdgeGaps(page: Page, target: Locator) {
  await expect
    .poll(
      async () => {
        const gaps = await edgeGaps(page, target);
        return gaps
          ? Math.min(gaps.top, gaps.left, gaps.bottom, gaps.right)
          : -1;
      },
      { timeout: 5000 },
    )
    .toBeGreaterThanOrEqual(EDGE_GAP);
}

async function drawRect(page: Page) {
  await selectTool(page, "2");
  await drag(page, { x: 500, y: 300 }, { x: 1150, y: 730 });
  await selectTool(page, "1");
}

async function rightClick(page: Page, x: number, y: number) {
  await page.mouse.click(x, y, { button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
}

test.describe("context menu viewport clamping", () => {
  test("element menu stays clear of every edge near the bottom right", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page);

    await rightClick(page, 1100, 710);

    await expectEdgeGaps(page, page.getByTestId("context-menu"));
  });

  test("empty canvas menu stays clear of every edge near the bottom", async ({
    page,
  }) => {
    await open(page);

    await rightClick(page, 60, 760);

    await expectEdgeGaps(page, page.getByTestId("context-menu"));
  });

  for (const id of ["layers", "download", "copy-image"]) {
    test(`"${id}" submenu stays clear of every edge`, async ({ page }) => {
      await open(page);
      await drawRect(page);

      await rightClick(page, 1100, 710);
      await page.getByTestId(`context-menu-${id}`).hover();
      const submenu = page.locator(".context-menu-submenu");
      await expect(submenu).toBeVisible();

      await expectEdgeGaps(page, submenu);
    });
  }
});
