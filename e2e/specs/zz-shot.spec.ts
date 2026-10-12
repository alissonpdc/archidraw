import { test, drag, selectTool, open } from "/root/GitHub/archidraw/e2e/fixtures";
test("kbd", async ({ page }) => {
  await open(page);
  await selectTool(page, "2");
  await drag(page, { x: 220, y: 100 }, { x: 340, y: 180 });
  await selectTool(page, "1");
  await page.evaluate(() => {
    const ed = (window as any).__editor__;
    ed.updateElementDetails(ed.getSnapshot().doc.elements[0].id, ["## Big note",""].concat(Array.from({length:30},(_,i)=>`- item ${i} with descriptive text`)).join("\n"));
  });
  const p = await page.evaluate(() => {
    const ed = (window as any).__editor__; const s = ed.getSnapshot();
    return ed.getScreenPoint((window as any).__detailsBadgeAnchor__(s.doc.elements[0], s.camera.zoom));
  });
  await page.mouse.move(p.x, p.y);
  await page.waitForSelector('[data-testid="hover-info-box"]');
  await page.waitForTimeout(200);
  const R = () => page.evaluate(() => { const r = document.querySelector('[data-testid="hover-info-box"]')!.getBoundingClientRect(); return Math.round(r.width)+"x"+Math.round(r.height); });
  const out = [await R()];
  await page.getByTestId("hover-info-resize").focus();
  out.push("focused:" + await page.evaluate(() => document.activeElement?.className));
  await page.keyboard.press("ArrowRight"); out.push(await R());
  await page.keyboard.press("ArrowDown"); out.push(await R());
  await page.keyboard.press("Shift+ArrowLeft"); out.push(await R());
  await page.keyboard.press("Shift+ArrowUp"); out.push(await R());
  process.stdout.write("K " + out.join(" | ") + "\n");
});
