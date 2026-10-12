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

/** moves the pointer onto the details badge ("i") — the only hover trigger */
async function hoverBadge(page: Page, index = 0) {
  const pos = await badgePos(page, index);
  await page.mouse.move(pos.x, pos.y);
}

const box = (page: Page) => page.getByTestId("hover-info-box");
const pre = (page: Page) => page.locator(".md-pre--structured");

/**
 * Exact source of the rendered block. `toContainText`/`innerText` normalise
 * whitespace, which would hide the very indentation this feature rewrites.
 */
async function preSource(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector(".md-pre--structured code")?.textContent ?? "",
  );
}

/** fenced source of `lang` wrapped as an element's details */
function fenced(lang: string, body: string[]): string {
  return ["```" + lang, ...body, "```"].join("\n");
}

const JSON_BODY = ['{"service":"api","port":8080,"tls":true,"retries":3}'];

const YAML_BODY = [
  "service: api",
  "ports:",
  "        - 8080",
  "        - 8443",
  "tls: true",
  "owner:",
  "        name: platform",
];

test.describe("json/yaml rendering in additional information", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await selectTool(page, "2");
    await drag(page, { x: 220, y: 100 }, { x: 340, y: 180 });
    await selectTool(page, "1");
  });

  test("a json fence is pretty-printed into one property per line", async ({
    page,
  }) => {
    await setDetails(page, fenced("json", JSON_BODY));
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    const el = pre(page);
    await expect(el).toBeVisible();
    await expect(el).toHaveAttribute("data-lang", "json");
    await expect(el).toHaveAttribute("data-structured", "true");
    await expect(el).toHaveAttribute("data-formatted", "true");

    // the single dense line is broken up and indented by the formatter
    const text = await preSource(page);
    expect(text).toBe(
      '{\n  "service": "api",\n  "port": 8080,\n  "tls": true,\n  "retries": 3\n}',
    );
  });

  test("json tokens are classified by kind", async ({ page }) => {
    await setDetails(page, fenced("json", JSON_BODY));
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    await expect(pre(page).locator(".md-tok-key")).toHaveCount(4);
    await expect(pre(page).locator(".md-tok-key").first()).toHaveText('"service"');
    await expect(pre(page).locator(".md-tok-string")).toHaveText('"api"');
    await expect(pre(page).locator(".md-tok-number")).toHaveCount(2);
    await expect(pre(page).locator(".md-tok-number").first()).toHaveText("8080");
    await expect(pre(page).locator(".md-tok-boolean")).toHaveText("true");
    await expect(pre(page).locator(".md-tok-punct").first()).toHaveText("{");
  });

  test("a yaml fence is re-indented onto two spaces", async ({ page }) => {
    await setDetails(page, fenced("yaml", YAML_BODY));
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    const el = pre(page);
    await expect(el).toHaveAttribute("data-lang", "yaml");
    await expect(el).toHaveAttribute("data-formatted", "true");

    const text = await preSource(page);
    // 8-space source nesting collapses to the canonical 2 spaces
    expect(text).toBe(
      "service: api\nports:\n  - 8080\n  - 8443\ntls: true\nowner:\n  name: platform",
    );
  });

  test("yaml tokens are classified by kind", async ({ page }) => {
    await setDetails(page, fenced("yaml", YAML_BODY));
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    await expect(pre(page).locator(".md-tok-key").first()).toHaveText("service:");
    await expect(pre(page).locator(".md-tok-key").filter({ hasText: "ports:" })).toHaveCount(1);
    await expect(pre(page).locator(".md-tok-number")).toHaveCount(2);
    await expect(pre(page).locator(".md-tok-boolean")).toHaveText("true");
  });

  test("yaml comments and quoted values keep their meaning", async ({ page }) => {
    await setDetails(
      page,
      fenced("yaml", [
        "# leading comment",
        'name: "quoted value"',
        "empty: ~",
        "list:",
        "        - alpha # trailing note",
      ]),
    );
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    await expect(pre(page).locator(".md-tok-comment")).toHaveCount(2);
    await expect(pre(page).locator(".md-tok-comment").first()).toHaveText(
      "# leading comment",
    );
    await expect(pre(page).locator(".md-tok-string")).toHaveText('"quoted value"');
    await expect(pre(page).locator(".md-tok-boolean")).toHaveText("~");
  });

  test("a yaml block scalar is never rewritten", async ({ page }) => {
    // the literal block's leading whitespace *is* its content, so the
    // formatter must refuse to touch it and render the source verbatim
    const source = ["cmd: |", "        echo one", "        echo two"].join("\n");
    await setDetails(page, fenced("yaml", source.split("\n")));
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    const el = pre(page);
    await expect(el).toHaveAttribute("data-formatted", "false");
    const text = await preSource(page);
    expect(text).toBe("cmd: |\n        echo one\n        echo two");
  });

  test("invalid json falls back to the verbatim source", async ({ page }) => {
    await setDetails(page, fenced("json", ["{trailing: 1,}"]));
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    const el = pre(page);
    await expect(el).toHaveAttribute("data-formatted", "false");
    await expect(el).toContainText("{trailing: 1,}");
    // still highlighted even though it could not be parsed
    await expect(el.locator(".md-tok-punct")).toHaveCount(3);
  });

  test("already-formatted json is reported as unchanged", async ({ page }) => {
    await setDetails(
      page,
      fenced("json", ["{", '  "a": 1', "}"].join("\n").split("\n")),
    );
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();
    await expect(pre(page)).toHaveAttribute("data-formatted", "false");
    await expect(pre(page)).toContainText('"a": 1');
  });

  test("yml and uppercase lang names are recognised", async ({ page }) => {
    await setDetails(page, fenced("YML", ["a: 1"]));
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();
    await expect(pre(page)).toHaveAttribute("data-lang", "yaml");

    await setDetails(page, fenced("JSON", ['{"a":1}']));
    await page.mouse.move(100, 600);
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();
    await expect(pre(page)).toHaveAttribute("data-lang", "json");
  });

  test("other fence languages keep the plain code block", async ({ page }) => {
    await setDetails(page, fenced("ts", ["const x = 1;"]));
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    await expect(pre(page)).toHaveCount(0);
    const plain = box(page).locator(".md-pre");
    await expect(plain).toBeVisible();
    await expect(plain).toHaveAttribute("data-lang", "ts");
    await expect(plain).not.toHaveAttribute("data-structured", "true");
    await expect(plain).toContainText("const x = 1;");
  });

  test("structured content is still never interpreted as markup", async ({
    page,
  }) => {
    await setDetails(
      page,
      fenced("json", ['{"note":"<img src=x onerror=alert(1)>"}']),
    );
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    await expect(box(page).locator("img")).toHaveCount(0);
    await expect(pre(page).locator(".md-tok-string")).toContainText(
      "<img src=x onerror=alert(1)>",
    );
  });

  test("structured blocks sit alongside the other markdown blocks", async ({
    page,
  }) => {
    await setDetails(
      page,
      [
        "## Payload",
        "",
        "Fenced below.",
        "",
        ...fenced("yaml", ["k: v"]).split("\n"),
        "",
        "After the fence.",
      ].join("\n"),
    );
    await hoverBadge(page);
    await expect(box(page)).toBeVisible();

    await expect(box(page).locator(".md-h2")).toHaveText("Payload");
    await expect(box(page).locator(".md-p")).toHaveCount(2);
    await expect(pre(page)).toHaveCount(1);
    await expect(pre(page)).toContainText("k: v");
  });
});

test.describe("structured code helpers", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  const call = (page: Page, fn: string, args: unknown[]) =>
    page.evaluate(
      ({ f, a }: { f: string; a: unknown[] }) => {
        const api = (window as any).__structuredCode__;
        return (api[f] as (...xs: unknown[]) => unknown)(...a);
      },
      { f: fn, a: args },
    );

  test("detectStructuredLang maps the supported fence languages", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const api = (window as any).__structuredCode__;
      const input = [
        undefined,
        "",
        "ts",
        "json",
        "JSON",
        " Json ",
        "jsonc",
        "json5",
        "yaml",
        "yml",
        "YAML",
        "md",
      ];
      return input.map((l) => api.detectStructuredLang(l));
    });
    expect(result).toEqual([
      null,
      null,
      null,
      "json",
      "json",
      "json",
      "json",
      "json",
      "yaml",
      "yaml",
      "yaml",
      null,
    ]);
  });

  test("formatJson pretty-prints and rejects invalid input", async ({ page }) => {
    const result = await page.evaluate(() => {
      const api = (window as any).__structuredCode__;
      return {
        compact: api.formatJson('{"a":1,"b":[2,3]}'),
        nested: api.formatJson('{"a":{"b":null}}'),
        scalar: api.formatJson("42"),
        invalid: api.formatJson("{oops}"),
        empty: api.formatJson(""),
      };
    });
    expect(result.compact).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
    expect(result.nested).toBe('{\n  "a": {\n    "b": null\n  }\n}');
    expect(result.scalar).toBe("42");
    expect(result.invalid).toBeNull();
    expect(result.empty).toBeNull();
  });

  test("formatYaml collapses deep indentation and trims trailing space", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const api = (window as any).__structuredCode__;
      return api.formatYaml(
        ["a:", "        b: 1   ", "        c:", "                d: 2", "", "e: 3"].join(
          "\n",
        ),
      );
    });
    expect(result).toBe(["a:", "  b: 1", "  c:", "    d: 2", "", "e: 3"].join("\n"));
  });

  test("formatYaml normalises nesting to two spaces and drops CRLF", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const api = (window as any).__structuredCode__;
      return api.formatYaml("a:\r\n b: 1\r\n c: 2\r\n");
    });
    expect(result).toBe("a:\n  b: 1\n  c: 2\n");
  });

  test("formatYaml refuses every document it cannot prove safe", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const api = (window as any).__structuredCode__;
      const cases: Record<string, string> = {
        blockScalar: "cmd: |\n  echo hi",
        folded: "cmd: >-\n  fold me",
        tabIndent: "a:\n\tb: 1",
        openDouble: 'a: "unterminated',
        openSingle: "a: 'unterminated",
        flowOpen: "a: [1, 2",
        flowObject: "a: {b: 1",
        comment: "# just a note\na: 1",
      };
      return Object.fromEntries(
        Object.entries(cases).map(([k, v]) => [k, api.formatYaml(v)]),
      );
    });

    expect(result.blockScalar).toBeNull();
    expect(result.folded).toBeNull();
    expect(result.tabIndent).toBeNull();
    expect(result.openDouble).toBeNull();
    expect(result.openSingle).toBeNull();
    expect(result.flowOpen).toBeNull();
    expect(result.flowObject).toBeNull();
    // a comment-only document is safe: it is returned (possibly identical)
    expect(result.comment).toBe("# just a note\na: 1");
  });

  test("formatYaml tolerates quotes, escapes and closed flow collections", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const api = (window as any).__structuredCode__;
      const cases: Record<string, string> = {
        doubleQuoted: 'a: "he said \\"hi\\" # not a comment"',
        singleQuoted: "a: 'it''s here'",
        closedFlow: "a: [1, 2]\nb: {c: 3}",
        trailingComment: "a: 1 # keep",
        empty: "",
        blankOnly: "\n\n",
      };
      return Object.fromEntries(
        Object.entries(cases).map(([k, v]) => [k, api.formatYaml(v)]),
      );
    });

    expect(result.doubleQuoted).toBe('a: "he said \\"hi\\" # not a comment"');
    expect(result.singleQuoted).toBe("a: 'it''s here'");
    expect(result.closedFlow).toBe("a: [1, 2]\nb: {c: 3}");
    expect(result.trailingComment).toBe("a: 1 # keep");
    expect(result.empty).toBe("");
    expect(result.blankOnly).toBe("\n\n");
  });

  test("tokenizeJson classifies every token kind", async ({ page }) => {
    const tokens = await call(page, "tokenizeJson", [
      '{"a": "x", "n": -1.5e3, "t": true, "z": null, "arr": [1]}',
    ]);
    const kinds = (tokens as { kind: string }[]).map((t) => t.kind);
    expect(kinds).toContain("key");
    expect(kinds).toContain("string");
    expect(kinds).toContain("number");
    expect(kinds).toContain("boolean");
    expect(kinds).toContain("punct");

    const byKind = (kind: string) =>
      (tokens as { text: string; kind: string }[])
        .filter((t) => t.kind === kind)
        .map((t) => t.text);
    expect(byKind("key")).toEqual(['"a"', '"n"', '"t"', '"z"', '"arr"']);
    expect(byKind("number")).toEqual(["-1.5e3", "1"]);
    expect(byKind("boolean")).toEqual(["true", "null"]);
  });

  test("tokenizeJson merges adjacent plain runs and survives odd input", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const api = (window as any).__structuredCode__;
      const render = (s: string) =>
        api.tokenizeJson(s).map((t: any) => `${t.kind}:${t.text}`);
      return {
        plain: render("abc"),
        unterminated: render('"open'),
        escaped: render('"a\\"b"'),
        bareWord: render("truex"),
        glued: render('{"a":1}'),
      };
    });

    expect(result.plain).toEqual(["plain:abc"]);
    expect(result.unterminated).toEqual(["string:\"open"]);
    expect(result.escaped).toEqual(['string:"a\\"b"']);
    expect(result.bareWord).toEqual(["plain:truex"]);
    expect(result.glued).toEqual([
      "punct:{",
      'key:"a"',
      "punct::",
      "number:1",
      "punct:}",
    ]);
  });

  test("tokenizeYaml classifies keys, values, markers and comments", async ({
    page,
  }) => {
    const tokens = await call(page, "tokenizeYaml", [
      [
        "name: api # note",
        "  - 8080",
        '  "quoted": \'v\'',
        "  flag: yes",
        "  ratio: 1.5",
        "  url: http://x.dev",
        "",
        "  # indented comment",
      ].join("\n"),
    ]);

    const byKind = (kind: string) =>
      (tokens as { text: string; kind: string }[])
        .filter((t) => t.kind === kind)
        .map((t) => t.text);

    expect(byKind("key")).toEqual([
      "name:",
      '"quoted":',
      "flag:",
      "ratio:",
      "url:",
    ]);
    expect(byKind("comment")).toEqual(["# note", "# indented comment"]);
    expect(byKind("string")).toEqual(["'v'"]);
    expect(byKind("boolean")).toContain("yes");
    expect(byKind("number")).toEqual(["8080", "1.5"]);
    // the url is a plain scalar: `//x.dev` must not swallow the colon
    expect(byKind("plain")).toContain("http://x.dev");
  });

  test("tokenizeYaml handles escapes, bare values and CRLF", async ({ page }) => {
    const result = await page.evaluate(() => {
      const api = (window as any).__structuredCode__;
      return {
        escaped: api.tokenizeYaml('a: "x \\" y"'),
        tilde: api.tokenizeYaml("a: ~"),
        hex: api.tokenizeYaml("a: 0x1f"),
        plus: api.tokenizeYaml("a: +7"),
        gluedHash: api.tokenizeYaml("a: b#c"),
        blank: api.tokenizeYaml(""),
        crlf: api.tokenizeYaml("a: 1\r\nb: 2"),
      };
    });

    const space = { text: " ", kind: "plain" };
    expect(result.escaped).toEqual([
      { text: "a:", kind: "key" },
      space,
      { text: '"x \\" y"', kind: "string" },
    ]);
    expect(result.tilde).toEqual([
      { text: "a:", kind: "key" },
      space,
      { text: "~", kind: "boolean" },
    ]);
    expect(result.hex).toEqual([
      { text: "a:", kind: "key" },
      space,
      { text: "0x1f", kind: "number" },
    ]);
    expect(result.plus).toEqual([
      { text: "a:", kind: "key" },
      space,
      { text: "+7", kind: "number" },
    ]);
    // `#` glued to a word is part of the scalar, not a comment
    expect(result.gluedHash).toEqual([
      { text: "a:", kind: "key" },
      space,
      { text: "b#c", kind: "plain" },
    ]);
    expect(result.blank).toEqual([]);
    expect(result.crlf).toEqual([
      { text: "a:", kind: "key" },
      space,
      { text: "1", kind: "number" },
      { text: "\n", kind: "plain" },
      { text: "b:", kind: "key" },
      space,
      { text: "2", kind: "number" },
    ]);
  });

  test("formatStructured and tokenizeStructured dispatch on the language", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const api = (window as any).__structuredCode__;
      return {
        json: api.formatStructured("json", '{"a":1}'),
        yaml: api.formatStructured("yaml", "a:\n        b: 1"),
        jsonTokens: api.tokenizeStructured("json", '{"a":1}').length,
        yamlTokens: api.tokenizeStructured("yaml", "a: 1").length,
      };
    });

    expect(result.json).toBe('{\n  "a": 1\n}');
    expect(result.yaml).toBe("a:\n  b: 1");
    expect(result.jsonTokens).toBeGreaterThan(0);
    expect(result.yamlTokens).toBeGreaterThan(0);
  });
});
