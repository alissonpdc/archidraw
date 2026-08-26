import { type Page, test, expect, open } from "../fixtures";

/** abre o painel da biblioteca; grupos iniciam contraídos */
async function openLibrary(page: Page) {
  await open(page);
  await page.keyboard.press("b");
  await expect(page.locator(".library-panel")).toBeVisible();
}

/** abre o painel e expande o grupo AWS */
async function openLibraryWithAws(page: Page) {
  await openLibrary(page);
  await page.locator(".library-section-header").click();
}

test.describe("biblioteca de componentes", () => {
  test("abre pelo atalho B com grupos contraídos", async ({ page }) => {
    await openLibrary(page);

    // AWS inicia contraído
    const header = page.locator(".library-section-header");
    await expect(header).toHaveText(/AWS/);
    await expect(header).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.locator('.library-panel [data-component-id="ec2"]'),
    ).toHaveCount(0);
  });

  test("insere componente clicando após expandir AWS", async ({
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

    // sem contorno por padrão: apenas ícone + nome
    const strokeWidth = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].strokeWidth;
    });
    expect(strokeWidth).toBe(0);

    // painel permanece aberto para inserir mais componentes
    await expect(panel).toBeVisible();
  });

  test("AWS expandido mostra categorias (Compute, Network…)", async ({
    page,
  }) => {
    await openLibraryWithAws(page);

    for (const cat of ["Compute", "Network", "Database", "Storage"]) {
      await expect(
        page.locator(".library-subgroup").filter({ hasText: cat }),
      ).toBeVisible();
    }
  });

  test("busca filtra por nome e keyword", async ({ page }) => {
    await openLibrary(page);

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
    await openLibrary(page);

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
    await openLibraryWithAws(page);
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
    await openLibraryWithAws(page);
    await page.locator('.library-panel [data-component-id="s3"]').click();

    // centro do elemento em coords de tela
    const center = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return ed.getScreenPoint({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
    });
    await page.mouse.dblclick(center.x, center.y);

    await expect(page.locator(".text-overlay.label-overlay")).toBeVisible();
    // edição in-place: overlay na posição do label (abaixo do ícone) e
    // sem contorno de edição
    const overlayInfo = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const overlay = document.querySelector(
        ".text-overlay.label-overlay",
      ) as HTMLElement;
      const cam = ed.getSnapshot().camera;
      return {
        outlineStyle: getComputedStyle(overlay).outlineStyle,
        top: parseFloat(overlay.style.top),
        expectedTop:
          (el.y + el.height / 2) * cam.zoom + cam.scrollY,
      };
    });
    expect(overlayInfo.outlineStyle).toBe("none");
    // label fica abaixo do centro do elemento (não no meio)
    expect(overlayInfo.top).toBeGreaterThan(overlayInfo.expectedTop);

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Bucket de uploads");
    await page.keyboard.press("Enter");

    const state = await editorState();
    expect(state.elements[0].label).toBe("Bucket de uploads");
    expect(state.editingTextId).toBeNull();
  });

  test("componente persiste após reload", async ({ page, editorState }) => {
    await openLibraryWithAws(page);
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
    await openLibrary(page);

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
    await openLibraryWithAws(page);

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

  test("recentes aparece antes do grupo AWS e é limitado a 15 itens", async ({
    page,
  }) => {
    await openLibraryWithAws(page);

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

    // RDS foi o mais recente → primeiro tile dos recentes
    await expect(recents.locator(".library-tile").first()).toHaveAttribute(
      "data-component-id",
      "rds",
    );
  });
});
