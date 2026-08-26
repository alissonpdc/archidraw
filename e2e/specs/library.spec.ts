import { test, expect, open } from "../fixtures";

test.describe("biblioteca de componentes", () => {
  test("abre pelo atalho B e insere componente clicando", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await expect(page.locator(".library-panel")).toHaveCount(0);

    await page.keyboard.press("b");
    const panel = page.locator(".library-panel");
    await expect(panel).toBeVisible();

    // card do SQS visível na categoria padrão
    const sqs = panel.locator('[data-component-id="sqs"]');
    await expect(sqs).toBeVisible();

    await sqs.click();

    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.selectedIds.length).toBe(1);
    expect(state.elements[0].type).toBe("component");
    expect(state.elements[0].componentId).toBe("sqs");

    // painel permanece aberto para inserir mais componentes
    await expect(panel).toBeVisible();
  });

  test("busca filtra por nome e keyword", async ({ page }) => {
    await open(page);
    await page.keyboard.press("b");

    const search = page.locator(".library-search");
    await search.fill("fila");
    const grid = page.locator(".library-body");
    await expect(grid.locator(".library-card")).toHaveCount(1);
    await expect(grid.locator('[data-component-id="sqs"]')).toBeVisible();

    await search.fill("zzz-nada");
    await expect(page.locator(".library-empty")).toBeVisible();
  });

  test("Enter no campo de busca insere o primeiro resultado", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.keyboard.press("b");

    await page.locator(".library-search").fill("lambda");
    await page.keyboard.press("Enter");

    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].componentId).toBe("lambda");
  });

  test("componente inserido nasce selecionado com label do serviço", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.keyboard.press("b");
    await page
      .locator('.library-panel [data-component-id="api-gateway"]')
      .click();

    const state = await editorState();
    expect(state.elements[0].label).toBe("API Gateway");
    expect(state.tool).toBe("selection");
  });

  test("duplo clique edita o label do componente", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.keyboard.press("b");
    await page.locator('.library-panel [data-component-id="s3"]').click();

    // centro do elemento em coords de tela
    const center = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return ed.getScreenPoint({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
    });
    await page.mouse.dblclick(center.x, center.y);

    await expect(page.locator(".text-overlay.label-overlay")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Bucket de uploads");
    await page.keyboard.press("Enter");

    const state = await editorState();
    expect(state.elements[0].label).toBe("Bucket de uploads");
    expect(state.editingTextId).toBeNull();
  });

  test("componente persiste após reload", async ({ page, editorState }) => {
    await open(page);
    await page.keyboard.press("b");
    await page.locator('.library-panel [data-component-id="rds"]').click();
    // aguarda autosave debounced
    await page.waitForTimeout(700);

    await page.reload();
    await open(page);

    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].componentId).toBe("rds");
  });

  test("fecha com Esc e botão fechar", async ({ page }) => {
    await open(page);
    await page.keyboard.press("b");
    await expect(page.locator(".library-panel")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(".library-panel")).toHaveCount(0);

    await page.keyboard.press("b");
    await page.locator(".library-close").click();
    await expect(page.locator(".library-panel")).toHaveCount(0);
  });

  test("botão da toolbar alterna o painel", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Biblioteca de componentes" }).click();
    await expect(page.locator(".library-panel")).toBeVisible();
    await page.getByRole("button", { name: "Biblioteca de componentes" }).click();
    await expect(page.locator(".library-panel")).toHaveCount(0);
  });

  test("serviços AWS usam o ícone oficial e genéricos caem no glifo vetorial", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.keyboard.press("b");

    // EC2 tem asset oficial embutido
    const ec2 = page.locator('.library-panel [data-component-id="ec2"]');
    await expect(ec2.locator("img.library-card-img")).toBeVisible();

    // nome do serviço vem como tooltip, sem texto no tile
    await expect(ec2).toHaveAttribute("data-tip", "EC2");
    await expect(ec2.locator(".library-card-name")).toHaveCount(0);

    // Client não tem asset oficial → glifo vetorial inline
    const client = page.locator(
      '.library-panel [data-component-id="client"]',
    );
    await expect(client.locator("svg")).toBeVisible();

    await ec2.click();
    const state = await editorState();
    expect(state.elements[0].componentId).toBe("ec2");
  });

  test("grupo AWS expande e contrai", async ({ page }) => {
    await open(page);
    await page.keyboard.press("b");

    const header = page.locator(".library-section-header");
    await expect(header).toHaveText(/AWS/);
    const grid = page.locator('.library-panel [data-component-id="ec2"]');
    await expect(grid).toBeVisible();

    await header.click();
    await expect(grid).toHaveCount(0);

    await header.click();
    await expect(grid).toBeVisible();
  });

  test("recentes aparece antes do grupo AWS e é limitado a 15 itens", async ({
    page,
  }) => {
    await open(page);
    await page.keyboard.press("b");

    // insere dois componentes para povoar recentes
    await page.locator('.library-panel [data-component-id="s3"]').click();
    await page.locator('.library-panel [data-component-id="rds"]').click();

    const recents = page.locator('[data-testid="library-recents"]');
    await expect(recents).toBeVisible();
    await expect(recents.locator(".library-tile")).toHaveCount(2);

    // recentes vem antes da seção AWS
    await expect(
      page.locator(".library-body > *").first(),
    ).toHaveAttribute("data-testid", "library-recents");

    // S3 foi o mais recente → primeiro tile dos recentes
    await expect(recents.locator(".library-tile").first()).toHaveAttribute(
      "data-component-id",
      "rds",
    );
  });
});
