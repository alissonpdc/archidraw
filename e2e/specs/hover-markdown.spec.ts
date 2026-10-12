import { test, expect, drag, selectTool, open, type Page } from "../fixtures";

/** absolute resize floor mirrored from HoverInfoBox */
const HARD_MIN = 80;

/** writes `details` onto the element at `index` and returns its id */
async function setDetails(page: Page, details: string, index = 0): Promise<string> {
  return page.evaluate(
    ({ d, i }) => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[i];
      ed.updateElementDetails(el.id, d);
      return el.id;
    },
    { d: details, i: index },
  );
}

/** screen position of the details badge ("i") of the element at `index` */
async function badgePos(page: Page, index = 0) {
  return page.evaluate((i) => {
    const ed = (window as any).__editor__;
    const s = ed.getSnapshot();
    const el = s.doc.elements[i];
    const a = (window as any).__detailsBadgeAnchor__(el, s.camera.zoom);
    return ed.getScreenPoint(a);
  }, index);
}

/** moves the pointer onto the details badge ("i") — the only hover trigger */
async function hoverBadge(page: Page, index = 0) {
  const pos = await badgePos(page, index);
  await page.mouse.move(pos.x, pos.y);
}

/** rect of a portal-rendered part of the card */
async function rectOf(page: Page, testId: string) {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: r.left,
      y: r.top,
      w: r.width,
      h: r.height,
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
    };
  }, testId);
}

/**
 * Hovers the badge, then walks the pointer into the middle of `testId` in
 * small steps. The card is anchored a few px away from the badge, so the gap
 * in between must stay valid — a single jump would never exercise that.
 */
async function walkInto(page: Page, testId: string, index = 0) {
  const badge = await badgePos(page, index);
  await page.mouse.move(badge.x, badge.y);
  await expect(page.getByTestId("hover-info-box")).toBeVisible();

  const target = await rectOf(page, testId);
  if (!target) throw new Error(`walkInto: "${testId}" is not rendered`);

  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      badge.x + ((target.cx - badge.x) * i) / steps,
      badge.y + ((target.cy - badge.y) * i) / steps,
    );
    // the card must survive every intermediate pixel
    await expect(page.getByTestId("hover-info-box")).toHaveCount(1);
  }
  return target;
}

const box = (page: Page) => page.getByTestId("hover-info-box");

test.describe("hover markdown preview", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 220, y: 100 }, { x: 340, y: 180 });
    await selectTool(page, "1");
  });

  test("hovering the element body shows nothing", async ({ page }) => {
    await setDetails(page, "latency 120ms");

    // the badge "i" is the only trigger: the shape itself must stay inert
    await page.mouse.move(280, 140);
    await page.waitForTimeout(700);
    await expect(box(page)).toHaveCount(0);

    // ...including a slow drag across it, the way a pointer really travels
    // (staying clear of the badge, which sits at the bottom-right corner)
    await page.mouse.move(230, 105);
    await page.mouse.move(300, 150, { steps: 10 });
    await page.waitForTimeout(700);
    await expect(box(page)).toHaveCount(0);
  });

  test("hovering the badge shows the preview", async ({ page }) => {
    await setDetails(page, "GET /orders");
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();
    await expect(box(page)).toContainText("GET /orders");

    // moving off the badge dismisses it
    await page.mouse.move(900, 620);
    await expect(box(page)).toHaveCount(0);
  });

  test("an element without details has no badge to hover", async ({ page }) => {
    // no details were ever written, so there is nothing to preview anywhere
    // on the shape — including where its badge would sit
    const anchor = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const s = ed.getSnapshot();
      const el = s.doc.elements[0];
      const a = (window as any).__detailsBadgeAnchor__(el, s.camera.zoom);
      return a;
    });
    expect(anchor).toBeNull();

    await page.mouse.move(280, 140);
    await page.waitForTimeout(400);
    await expect(box(page)).toHaveCount(0);
  });

  test("a pointerdown clears the preview", async ({ page }) => {
    await setDetails(page, "note");
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    await page.mouse.down();
    await page.mouse.up();
    await expect(box(page)).toHaveCount(0);
  });

  test("undoing the details dismisses the preview", async ({ page }) => {
    await setDetails(page, "temporary note");
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    // the card is driven by pointer events, not editor state; undo must not
    // leave it on screen showing content that no longer exists
    await page.keyboard.press("Control+z");
    await expect(box(page)).toHaveCount(0);
  });

  test("deleting the hovered element dismisses the preview", async ({
    page,
  }) => {
    await setDetails(page, "doomed");
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    await page.keyboard.press("Delete");
    await expect(box(page)).toHaveCount(0);
  });

  test("markdown blocks render as real elements", async ({ page }) => {
    await setDetails(
      page,
      [
        "## Overview",
        "",
        "Service with **bold**, *emphasis* and `inlineCode()`.",
        "",
        "- first item",
        "- second item",
        "",
        "1. step one",
        "2. step two",
        "",
        "> a quoted note",
        "",
        "```ts",
        "const x = 1;",
        "```",
        "",
        "| Env | Port |",
        "|:----|----:|",
        "| prod | 443 |",
        "",
        "---",
        "",
        "[runbook](https://example.com/runbook)",
      ].join("\n"),
    );

    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    await expect(box(page).locator(".md-h2")).toHaveText("Overview");
    await expect(box(page).locator(".md-p strong")).toHaveText("bold");
    await expect(box(page).locator(".md-p em")).toHaveText("emphasis");
    await expect(box(page).locator(".md-code-inline")).toHaveText("inlineCode()");
    await expect(box(page).locator(".md-ul .md-li")).toHaveCount(2);
    await expect(box(page).locator(".md-ol .md-li")).toHaveCount(2);
    await expect(box(page).locator(".md-quote")).toContainText("a quoted note");
    await expect(box(page).locator(".md-pre")).toContainText("const x = 1;");
    await expect(box(page).locator(".md-pre")).toHaveAttribute("data-lang", "ts");
    await expect(box(page).locator(".md-hr")).toHaveCount(1);

    const header = box(page).locator(".md-table th");
    await expect(header).toHaveCount(2);
    await expect(header.nth(1)).toHaveText("Port");
    // right-aligned column keeps its alignment
    await expect(header.nth(1)).toHaveCSS("text-align", "right");
    await expect(box(page).locator(".md-table td")).toHaveCount(2);

    const link = box(page).locator(".md-link");
    await expect(link).toHaveText("runbook");
    await expect(link).toHaveAttribute("href", "https://example.com/runbook");
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("links are the only markup that survives: no HTML is interpreted", async ({
    page,
  }) => {
    await setDetails(page, '<img src=x onerror="alert(1)"> and <b>raw</b>');

    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    // the tags are shown as literal text, not turned into elements
    await expect(box(page).locator("b")).toHaveCount(0);
    await expect(box(page).locator("img")).toHaveCount(0);
    await expect(box(page).locator(".md-root")).toContainText("<b>raw</b>");
  });

  test("a long preview stays clamped inside the viewport", async ({ page }) => {
    // a second shape in the bottom-right corner, clear of the zoom widget
    await selectTool(page, "2");
    await drag(page, { x: 1060, y: 690 }, { x: 1230, y: 750 });
    await selectTool(page, "1");
    await setDetails(
      page,
      Array.from({ length: 40 }, (_, i) => `line ${i} of a very long note`).join(
        "\n\n",
      ),
      1,
    );

    await hoverBadge(page, 1);
    await expect(box(page)).toBeVisible();

    const fits = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="hover-info-box"]')!;
      const r = el.getBoundingClientRect();
      return {
        right: r.right,
        bottom: r.bottom,
        left: r.left,
        top: r.top,
        w: window.innerWidth,
        h: window.innerHeight,
      };
    });
    expect(fits.right).toBeLessThanOrEqual(fits.w - 8);
    expect(fits.bottom).toBeLessThanOrEqual(fits.h - 8);
    // and it must not be pushed off the opposite edges either
    expect(fits.left).toBeGreaterThanOrEqual(8);
    expect(fits.top).toBeGreaterThanOrEqual(8);
  });
});

test.describe("hover preview frame", () => {
  /** content long enough that the body must scroll inside the frame */
  function longNote() {
    return ["## Big note", ""]
      .concat(
        Array.from({ length: 30 }, (_, i) => `- item ${i} with descriptive text`),
      )
      .join("\n");
  }

  test.beforeEach(async ({ page }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 220, y: 100 }, { x: 340, y: 180 });
    await selectTool(page, "1");
  });

  test("the pointer can travel from the badge into the frame", async ({
    page,
  }) => {
    await setDetails(page, longNote());
    // walking, not jumping: the gap between badge and frame must stay valid
    await walkInto(page, "hover-info-body");
    await expect(box(page)).toBeVisible();
  });

  test("the frame scrolls its content without dismissing", async ({ page }) => {
    await setDetails(page, longNote());
    const body = await walkInto(page, "hover-info-body");

    const overflow = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="hover-info-body"]') as HTMLElement;
      return el.scrollHeight - el.clientHeight;
    });
    expect(overflow).toBeGreaterThan(0);

    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(150);

    const after = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="hover-info-body"]') as HTMLElement;
      return el.scrollTop;
    });
    expect(after).toBeGreaterThan(0);
    // the wheel over the frame must not close it (nor pan the canvas)
    await expect(box(page)).toBeVisible();
    expect(body.w).toBeGreaterThan(0);
  });

  test("the title is separated from the content", async ({ page }) => {
    await setDetails(page, "# heading\n\nbody text");
    await hoverBadge(page);

    const sep = page.getByTestId("hover-info-sep");
    await expect(sep).toBeVisible();
    // it draws a rule, and sits between the title and the body
    const order = await page.evaluate(() => {
      const t = document.querySelector(".hover-info-title")!;
      const s = document.querySelector(".hover-info-sep")!;
      const b = document.querySelector(".hover-info-body")!;
      const rt = t.getBoundingClientRect();
      const rs = s.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return {
        title: rt.top < rs.top && rs.top < rb.top,
        border: getComputedStyle(s).borderTopWidth,
        titleText: t.textContent,
      };
    });
    expect(order.title).toBe(true);
    expect(parseFloat(order.border)).toBeGreaterThan(0);
    expect(order.titleText).toBe("Additional Information");
  });

  test("the bottom-right corner resizes the frame", async ({ page }) => {
    await setDetails(page, longNote());
    await walkInto(page, "hover-info-body");

    const before = await rectOf(page, "hover-info-box");
    const grip = await rectOf(page, "hover-info-resize");
    expect(grip).not.toBeNull();

    await page.mouse.move(grip.cx, grip.cy);
    await page.mouse.down();
    await page.mouse.move(grip.cx + 160, grip.cy + 160, { steps: 12 });
    await page.mouse.up();

    const after = await rectOf(page, "hover-info-box");
    await expect(box(page)).toBeVisible();
    expect(after.w).toBeGreaterThan(before.w + 100);
    expect(after.h).toBeGreaterThan(before.h + 100);

    // the content adopts the new space instead of staying cramped
    const overflow = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="hover-info-body"]') as HTMLElement;
      return el.scrollHeight - el.clientHeight;
    });
    expect(overflow).toBeLessThan(100);

    // the title stays pinned and the body takes the extra room
    const grown = await page.evaluate(() => {
      const t = document.querySelector(".hover-info-title")!.getBoundingClientRect();
      const b = document.querySelector(".hover-info-body")!.getBoundingClientRect();
      return { titleH: t.height, bodyH: b.height };
    });
    expect(grown.titleH).toBeGreaterThan(0);
    expect(grown.bodyH).toBeGreaterThan(0);
  });

  test("a resized frame is still clamped inside the viewport", async ({
    page,
  }) => {
    await setDetails(page, longNote());
    await walkInto(page, "hover-info-body");

    const grip = await rectOf(page, "hover-info-resize");
    // drag far past the viewport edges
    await page.mouse.move(grip.cx, grip.cy);
    await page.mouse.down();
    await page.mouse.move(grip.cx + 3000, grip.cy + 3000, { steps: 15 });
    await page.mouse.up();

    const fits = await page.evaluate(() => {
      const r = document
        .querySelector('[data-testid="hover-info-box"]')!
        .getBoundingClientRect();
      return {
        right: r.right,
        bottom: r.bottom,
        left: r.left,
        top: r.top,
        w: window.innerWidth,
        h: window.innerHeight,
      };
    });
    expect(fits.right).toBeLessThanOrEqual(fits.w - 8);
    expect(fits.bottom).toBeLessThanOrEqual(fits.h - 8);
    expect(fits.left).toBeGreaterThanOrEqual(8);
    expect(fits.top).toBeGreaterThanOrEqual(8);
  });

  test("the resize grip is keyboard operable", async ({ page }) => {
    await setDetails(page, longNote());
    await walkInto(page, "hover-info-body");

    const before = await rectOf(page, "hover-info-box");
    await page.getByTestId("hover-info-resize").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const grown = await rectOf(page, "hover-info-box");
    expect(grown.w).toBeGreaterThan(before.w);
    expect(grown.h).toBeGreaterThan(before.h);

    // Shift takes bigger steps, and the frame never collapses out of use
    await page.keyboard.press("Shift+ArrowLeft");
    await page.keyboard.press("Shift+ArrowUp");
    const shrunk = await rectOf(page, "hover-info-box");
    expect(shrunk.w).toBeLessThan(grown.w);
    expect(shrunk.h).toBeLessThan(grown.h);
    expect(shrunk.w).toBeGreaterThanOrEqual(HARD_MIN);
    expect(shrunk.h).toBeGreaterThanOrEqual(HARD_MIN);
  });

  test("Escape dismisses the frame", async ({ page }) => {
    await setDetails(page, "note");
    await walkInto(page, "hover-info-body");
    await page.keyboard.press("Escape");
    await expect(box(page)).toHaveCount(0);
  });

  test("a click inside the frame does not dismiss it", async ({ page }) => {
    await setDetails(page, longNote());
    const body = await walkInto(page, "hover-info-body");

    const before = await page.evaluate(() => {
      const st = (window as any).__editor__.getSnapshot();
      return [...st.selectedIds];
    });

    await page.mouse.click(body.cx, body.cy);
    await expect(box(page)).toBeVisible();

    // and the click must not have leaked through to the canvas: no marquee,
    // no change to the selection
    const s = await page.evaluate(() => {
      const st = (window as any).__editor__.getSnapshot();
      return { marquee: !!st.marquee, selected: [...st.selectedIds] };
    });
    expect(s.marquee).toBe(false);
    expect(s.selected).toEqual(before);
  });

  test("a click outside the frame dismisses it", async ({ page }) => {
    await setDetails(page, "note");
    await walkInto(page, "hover-info-body");

    await page.mouse.click(900, 640);
    await expect(box(page)).toHaveCount(0);
  });

  test("links inside the frame are real clickable links", async ({ page }) => {
    await setDetails(page, "see the [runbook](https://example.com/runbook)");
    const link = box(page).locator(".md-link");
    const linkRect = await walkInto(page, "hover-info-body");

    // the frame accepts the pointer, so the anchor is genuinely hittable
    const hits = await page.evaluate(() => {
      const a = document.querySelector(".md-link")!;
      const r = a.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        pointerEvents: getComputedStyle(a).pointerEvents,
        reached: hit === a || a.contains(hit),
      };
    });
    expect(hits.pointerEvents).toBe("auto");
    expect(hits.reached).toBe(true);
    expect(linkRect.w).toBeGreaterThan(0);
    await expect(link).toHaveAttribute("href", "https://example.com/runbook");
  });
});

test.describe("markdown parser", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("dangerous protocols never become links", async ({ page }) => {
    const links = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md
        .parseMarkdown(
          "[a](javascript:alert(1)) [b](data:text/html;base64,PHNjcmlwdD4=) [c](/local) [d](https://ok.dev)",
        )
        .flatMap((b: any) => b.children ?? [])
        .filter((n: any) => n.kind === "link")
        .map((n: any) => n.href);
    });
    expect(links).toEqual(["https://ok.dev"]);
  });

  test("word-glued delimiters stay literal", async ({ page }) => {
    const text = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md
        .parseMarkdown("snake_case_name 2*3 a_b_c")
        .flatMap((b: any) => b.children)
        .map((n: any) => `${n.kind}:${n.value ?? ""}`);
    });
    expect(text).toEqual(["text:snake_case_name 2*3 a_b_c"]);
  });

  test("a bare domain is upgraded to https", async ({ page }) => {
    const hrefs = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md
        .parseMarkdown("[docs](runbook.example.com/x)")
        .flatMap((b: any) => b.children)
        .filter((n: any) => n.kind === "link")
        .map((n: any) => n.href);
    });
    expect(hrefs).toEqual(["https://runbook.example.com/x"]);
  });

  test("trailing punctuation is not part of an autolink", async ({ page }) => {
    const nodes = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md
        .parseMarkdown("see https://example.com/a, ok")
        .flatMap((b: any) => b.children)
        .map((n: any) => n.kind + ":" + (n.value ?? n.href ?? ""));
    });
    expect(nodes).toEqual([
      "text:see ",
      "link:https://example.com/a",
      "text:, ok",
    ]);
  });

  test("a link title is captured", async ({ page }) => {
    const link = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown('[x](https://a.dev "the title")')[0].children[0];
    });
    expect(link).toMatchObject({ kind: "link", href: "https://a.dev", title: "the title" });
  });

  test("images parse into image nodes", async ({ page }) => {
    const img = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("![alt](https://cdn.dev/x.png)")[0].children[0];
    });
    expect(img).toMatchObject({
      kind: "image",
      src: "https://cdn.dev/x.png",
      alt: "alt",
    });
  });

  test("an unbalanced image marker is literal text", async ({ page }) => {
    const nodes = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("![alt](javascript:x)")[0].children;
    });
    expect(nodes).toEqual([{ kind: "text", value: "![alt](javascript:x)" }]);
  });

  test("backslash escapes are honoured", async ({ page }) => {
    const nodes = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("\\*not em\\* and \\# not heading")[0].children;
    });
    expect(nodes).toEqual([{ kind: "text", value: "*not em* and # not heading" }]);
  });

  test("an escaped pipe survives inside a table cell", async ({ page }) => {
    const cells = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("| a | b |\n|---|---|\n| x\\|y | z |")[0].rows[0];
    });
    expect(cells[0][0]).toEqual({ kind: "text", value: "x|y" });
  });

  test("an unterminated fence still yields a code block", async ({ page }) => {
    const block = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("```\nunclosed body")[0];
    });
    expect(block).toEqual({ kind: "code", lang: undefined, value: "unclosed body" });
  });

  test("a tilde fence is supported", async ({ page }) => {
    const block = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("~~~\nplain\n~~~")[0];
    });
    expect(block).toEqual({ kind: "code", value: "plain" });
  });

  test("hard-wrapped prose becomes explicit breaks", async ({ page }) => {
    const children = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("line one\nline two")[0].children;
    });
    expect(children).toEqual([
      { kind: "text", value: "line one" },
      { kind: "break" },
      { kind: "text", value: "line two" },
    ]);
  });

  test("CRLF input parses the same as LF", async ({ page }) => {
    const blocks = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("## H\r\n\r\nbody");
    });
    expect(blocks.map((b: any) => b.kind)).toEqual(["heading", "paragraph"]);
  });

  test("an ordered list keeps its start number", async ({ page }) => {
    const list = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("3. three\n4. four")[0];
    });
    expect(list).toMatchObject({ kind: "list", ordered: true, start: 3 });
  });

  test("deeper than h6 stays a paragraph", async ({ page }) => {
    const block = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("####### seven")[0];
    });
    expect(block.kind).toBe("paragraph");
  });

  test("a pipe without a divider row is not a table", async ({ page }) => {
    const block = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("a | b\nnot a divider")[0];
    });
    expect(block.kind).toBe("paragraph");
  });

  test("short rows are padded to the header width", async ({ page }) => {
    const rows = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("| a | b | c |\n|---|---|---|\n| 1 | 2 |")[0].rows;
    });
    expect(rows[0]).toHaveLength(3);
    expect(rows[0][2]).toEqual([]);
  });

  test("extra cells beyond the header are dropped", async ({ page }) => {
    const rows = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("| a |\n|---|\n| 1 | 2 |")[0].rows;
    });
    expect(rows[0]).toHaveLength(1);
  });

  test("blockquote markers nest any block", async ({ page }) => {
    const quote = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("> ## inside\n> - a\n> - b")[0];
    });
    expect(quote.children.map((b: any) => b.kind)).toEqual(["heading", "list"]);
  });

  test("thematic breaks accept spaced and underscored forms", async ({ page }) => {
    const kinds = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return ["---", "***", "___", "* * *"].map((s) => md.parseMarkdown(s)[0].kind);
    });
    expect(kinds).toEqual(["hr", "hr", "hr", "hr"]);
  });

  test("nesting resolves inside emphasis", async ({ page }) => {
    const nodes = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("**bold with `code`**")[0].children;
    });
    expect(nodes).toEqual([
      {
        kind: "strong",
        children: [
          { kind: "text", value: "bold with " },
          { kind: "code", value: "code" },
        ],
      },
    ]);
  });

  test("an unpaired delimiter stays literal", async ({ page }) => {
    const nodes = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("a ** b ~~ c")[0].children;
    });
    expect(nodes.map((n: any) => n.kind)).toEqual(["text"]);
    expect((nodes[0] as any).value).toBe("a ** b ~~ c");
  });

  test("an empty emphasis span is not rendered", async ({ page }) => {
    const nodes = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("a **** b")[0].children;
    });
    expect(nodes.map((n: any) => n.kind)).toEqual(["text"]);
  });

  test("inline code may contain a backtick", async ({ page }) => {
    const nodes = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("``b`c``")[0].children;
    });
    expect(nodes).toEqual([{ kind: "code", value: "b`c" }]);
  });

  test("an unmatched code backtick is literal", async ({ page }) => {
    const nodes = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("a ` b")[0].children;
    });
    expect((nodes[0] as any).value).toBe("a ` b");
  });

  test("blank code content falls back to literal text", async ({ page }) => {
    const nodes = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("a `` b")[0].children;
    });
    expect((nodes[0] as any).value).toBe("a `` b");
  });

  test("a link label may itself carry markup", async ({ page }) => {
    const link = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("[**bold**](https://a.dev)")[0].children[0];
    });
    expect(link.kind).toBe("link");
    expect((link as any).children[0].kind).toBe("strong");
  });

  test("an unterminated link leaves its marker literal", async ({ page }) => {
    const nodes = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("[a](https://b.dev")[0].children;
    });
    expect(nodes[0]).toEqual({ kind: "text", value: "[a](" });
    // the dangling URL is still picked up as a bare autolink
    expect(nodes[1]).toMatchObject({ kind: "link", href: "https://b.dev" });
  });

  test("a link with an empty label is literal", async ({ page }) => {
    const nodes = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("[](https://a.dev)")[0].children;
    });
    expect(nodes[0]).toEqual({ kind: "text", value: "[](" });
    expect(nodes[1]).toMatchObject({ kind: "link", href: "https://a.dev" });
  });

  test("isPlainText tells plain prose from marked-up notes", async ({ page }) => {
    const result = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return [md.isPlainText("just a note"), md.isPlainText("# heading")];
    });
    expect(result).toEqual([true, false]);
  });

  test("blank input produces no blocks", async ({ page }) => {
    const blocks = await page.evaluate(() => {
      const md = (window as any).__markdown__;
      return md.parseMarkdown("   \n\n  ");
    });
    expect(blocks).toEqual([]);
  });
});
