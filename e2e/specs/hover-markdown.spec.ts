import { test, expect, drag, selectTool, open, type Page } from "../fixtures";

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

const box = (page: Page) => page.getByTestId("hover-info-box");

test.describe("hover markdown preview", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 220, y: 100 }, { x: 340, y: 180 });
    await selectTool(page, "1");
  });

  test("hovering the element body opens the preview after the delay", async ({
    page,
  }) => {
    await setDetails(page, "latency 120ms");

    await page.mouse.move(280, 140);
    // the body card is delayed: it must not exist yet
    await expect(box(page)).toHaveCount(0);

    await expect(box(page)).toBeVisible();
    await expect(box(page)).toHaveAttribute("data-source", "body");
    await expect(box(page)).toContainText("latency 120ms");

    // moving off the element dismisses it
    await page.mouse.move(900, 620);
    await expect(box(page)).toHaveCount(0);
  });

  test("hovering the badge stays instant", async ({ page }) => {
    await setDetails(page, "GET /orders");
    const pos = await badgePos(page);

    await page.mouse.move(pos.x, pos.y);
    await expect(box(page)).toBeVisible();
    await expect(box(page)).toHaveAttribute("data-source", "badge");

    // the element body is under the badge's neighbourhood but the badge wins
    const badge = await badgePos(page);
    expect(badge.x).toBeCloseTo(pos.x, 0);
  });

  test("an element without details shows no preview", async ({ page }) => {
    await page.mouse.move(280, 140);
    await page.waitForTimeout(600);
    await expect(box(page)).toHaveCount(0);
  });

  test("a pointerdown clears the preview", async ({ page }) => {
    await setDetails(page, "note");
    await page.mouse.move(280, 140);
    await expect(box(page)).toBeVisible();

    await page.mouse.down();
    await page.mouse.up();
    await expect(box(page)).toHaveCount(0);
  });

  test("undoing the details dismisses the preview", async ({ page }) => {
    await setDetails(page, "temporary note");
    await page.mouse.move(280, 140);
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
    await page.mouse.move(280, 140);
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

    await page.mouse.move(280, 140);
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

    await page.mouse.move(280, 140);
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

    await page.mouse.move(1150, 720);
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
