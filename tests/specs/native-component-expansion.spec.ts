import { expect, importFile, open, pressPasteText, test } from "../fixtures";

test.describe("native component expansion for AI and clipboard", () => {
  test("pasting sd- component expands into native elements with shared groupId", async ({
    page,
    editorState,
  }) => {
    await open(page);

    const payload = {
      type: "archidraw/elements",
      elements: [
        {
          type: "component",
          componentId: "sd-data-storage-relational-db",
          x: 200,
          y: 150,
        },
      ],
    };

    await pressPasteText(page, JSON.stringify(payload));

    const state = await editorState();
    expect(state.elementCount).toBe(3);
    expect(state.elements.every((el) => el.type !== "component")).toBe(true);

    const types = state.elements.map((el) => el.type);
    expect(types).toContain("polygon");
    expect(types).toContain("ellipse");
    expect(types).toContain("text");

    const firstGid = state.elements[0].groupId;
    expect(firstGid).toBeTruthy();
    expect(state.elements.every((el) => el.groupId === firstGid)).toBe(true);

    const docElements = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );
    const textEl = docElements.find((el: any) => el.type === "text");
    expect(textEl?.text).toBe("Relational DB");
  });

  test("pasting sd- component with custom label overrides caption", async ({
    page,
    editorState,
  }) => {
    await open(page);

    const payload = [
      {
        type: "component",
        componentId: "sd-data-storage-relational-db",
        x: 100,
        y: 100,
        label: "Customers DB",
      },
    ];

    await pressPasteText(page, JSON.stringify(payload));

    const docElements = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );
    const textEl = docElements.find((el: any) => el.type === "text");
    expect(textEl?.text).toBe("Customers DB");
  });

  test("pasting sd- component with bound arrow rebinds to primary shape", async ({
    page,
    editorState,
  }) => {
    await open(page);

    const payload = {
      type: "archidraw/elements",
      elements: [
        {
          id: "db_node",
          type: "component",
          componentId: "sd-data-storage-relational-db",
          groupId: "explicit_grp",
          x: 200,
          y: 200,
          label: "SQL",
        },
        {
          id: "queue_node",
          type: "component",
          componentId: "sd-messaging-events-message-queue",
          x: 400,
          y: 200,
        },
        {
          id: "rect_plain",
          type: "rectangle",
          x: 600,
          y: 200,
          width: 80,
          height: 80,
        },
        {
          id: "arrow_1",
          type: "arrow",
          x: 250,
          y: 200,
          width: 150,
          height: 0,
          startBinding: { elementId: "db_node", nx: 1, ny: 0.5 },
          endBinding: { elementId: "queue_node", nx: 0, ny: 0.5 },
        },
        {
          id: "ctx_1",
          type: "context",
          x: 100,
          y: 100,
          width: 800,
          height: 400,
          childIds: ["db_node", "rect_plain"],
        },
      ],
    };

    await pressPasteText(page, JSON.stringify(payload));

    const docElements = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );
    const arrow = docElements.find(
      (el: any) => el.type === "arrow" && el.startBinding,
    );
    const dbPolygon = docElements.find(
      (el: any) => el.type === "polygon" && el.label === "SQL",
    );
    const queueTarget = docElements.find(
      (el: any) => el.id === arrow?.endBinding?.elementId,
    );
    const ctx = docElements.find((el: any) => el.type === "context");

    expect(arrow).toBeDefined();
    expect(dbPolygon).toBeDefined();
    expect(queueTarget).toBeDefined();
    expect(arrow?.startBinding?.elementId).toBe(dbPolygon?.id);
    expect(queueTarget?.type).toBe("ellipse");
    expect(arrow?.x).toBe(dbPolygon!.x + dbPolygon!.width);
    expect(arrow?.x + arrow!.width).toBe(queueTarget!.x);
    expect(ctx?.childIds).toContain(dbPolygon?.id);
  });

  test("pasting sd- component snaps single-ended arrows (start-only and end-only)", async ({
    page,
  }) => {
    await open(page);

    const payload = {
      type: "archidraw/elements",
      elements: [
        {
          id: "comp_start",
          type: "component",
          componentId: "sd-data-storage-relational-db",
          x: 200,
          y: 200,
        },
        {
          id: "comp_end",
          type: "component",
          componentId: "sd-data-storage-relational-db",
          x: 600,
          y: 200,
        },
        {
          id: "arrow_start_only",
          type: "arrow",
          x: 200,
          y: 200,
          width: 100,
          height: 0,
          startBinding: { elementId: "comp_start", nx: 1, ny: 0.5 },
        },
        {
          id: "arrow_end_only",
          type: "arrow",
          x: 500,
          y: 200,
          width: 100,
          height: 0,
          endBinding: { elementId: "comp_end", nx: 0, ny: 0.5 },
        },
      ],
    };

    await pressPasteText(page, JSON.stringify(payload));

    const docElements = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );
    const arrowStartOnly = docElements.find(
      (el: any) => el.type === "arrow" && el.startBinding && !el.endBinding,
    );
    const arrowEndOnly = docElements.find(
      (el: any) => el.type === "arrow" && !el.startBinding && el.endBinding,
    );
    expect(arrowStartOnly).toBeDefined();
    expect(arrowEndOnly).toBeDefined();
    expect(arrowStartOnly?.startBinding?.elementId).toBeTruthy();
    expect(arrowEndOnly?.endBinding?.elementId).toBeTruthy();
  });

  test("workspace file with sd- component expands native elements on import", async ({
    page,
    editorState,
  }) => {
    await open(page);

    const docPayload = {
      schemaVersion: 2,
      activeTabId: "tab_1",
      tabs: [
        {
          id: "tab_1",
          name: "Imported Diagram",
          doc: {
            elements: [
              {
                id: "c_queue",
                type: "component",
                componentId: "sd-messaging-events-message-queue",
                x: 150,
                y: 150,
                label: "Orders Queue",
              },
            ],
          },
          camera: { zoom: 1, scrollX: 0, scrollY: 0 },
        },
      ],
    };

    await importFile(page, {
      name: "sd-diagram.archidraw",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(docPayload), "utf8"),
    });

    const docElements = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );
    expect(docElements.every((el: any) => el.type !== "component")).toBe(true);
    const textEl = docElements.find((el: any) => el.type === "text");
    expect(textEl?.text).toBe("Orders Queue");
  });

  test("anchors arrows accurately in all four cardinal directions (top, bottom, left, right)", async ({
    page,
  }) => {
    await open(page);

    const payload = {
      type: "archidraw/elements",
      elements: [
        {
          id: "center_db",
          type: "component",
          componentId: "sd-data-storage-relational-db",
          x: 400,
          y: 400,
        },
        {
          id: "top_node",
          type: "rectangle",
          x: 400,
          y: 200,
          width: 80,
          height: 50,
        },
        {
          id: "bottom_node",
          type: "rectangle",
          x: 400,
          y: 600,
          width: 80,
          height: 50,
        },
        {
          id: "left_node",
          type: "rectangle",
          x: 200,
          y: 400,
          width: 80,
          height: 50,
        },
        {
          id: "right_node",
          type: "rectangle",
          x: 600,
          y: 400,
          width: 80,
          height: 50,
        },
        {
          id: "arr_from_top",
          type: "arrow",
          x: 440,
          y: 250,
          width: 0,
          height: 150,
          startBinding: { elementId: "top_node", side: "bottom", nx: 0.5, ny: 1 },
          endBinding: { elementId: "center_db", side: "top", nx: 0.5, ny: 0 },
        },
        {
          id: "arr_to_bottom",
          type: "arrow",
          x: 440,
          y: 450,
          width: 0,
          height: 150,
          startBinding: { elementId: "center_db", side: "bottom", nx: 0.5, ny: 1 },
          endBinding: { elementId: "bottom_node", side: "top", nx: 0.5, ny: 0 },
        },
        {
          id: "arr_from_left",
          type: "arrow",
          x: 280,
          y: 425,
          width: 120,
          height: 0,
          startBinding: { elementId: "left_node", side: "right", nx: 1, ny: 0.5 },
          endBinding: { elementId: "center_db", side: "left", nx: 0, ny: 0.5 },
        },
        {
          id: "arr_to_right",
          type: "arrow",
          x: 450,
          y: 425,
          width: 150,
          height: 0,
          startBinding: { elementId: "center_db", side: "right", nx: 1, ny: 0.5 },
          endBinding: { elementId: "right_node", side: "left", nx: 0, ny: 0.5 },
        },
      ],
    };

    await pressPasteText(page, JSON.stringify(payload));

    const docElements = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );

    const arrows = docElements.filter((e: any) => e.type === "arrow");
    expect(arrows.length).toBe(4);

    // Sort by y to distinguish top/bottom, and by x for left/right
    const arrTop = arrows.find((a: any) => a.endBinding && a.height > 50);
    const arrBottom = arrows.find((a: any) => a.startBinding && a.height > 50);
    const arrLeft = arrows.find((a: any) => a.endBinding && a.width > 50);
    const arrRight = arrows.find((a: any) => a.startBinding && a.width > 50);

    expect(arrTop?.endBinding?.elementId).toBeTruthy();
    expect(arrBottom?.startBinding?.elementId).toBeTruthy();
    expect(arrLeft?.endBinding?.elementId).toBeTruthy();
    expect(arrRight?.startBinding?.elementId).toBeTruthy();

    const targetTop = docElements.find((e: any) => e.id === arrTop?.endBinding?.elementId);
    const targetBottom = docElements.find((e: any) => e.id === arrBottom?.startBinding?.elementId);
    const targetLeft = docElements.find((e: any) => e.id === arrLeft?.endBinding?.elementId);
    const targetRight = docElements.find((e: any) => e.id === arrRight?.startBinding?.elementId);

    expect(targetTop).toBeDefined();
    expect(targetBottom).toBeDefined();
    expect(targetLeft).toBeDefined();
    expect(targetRight).toBeDefined();

    expect(arrTop!.y + arrTop!.height).toBe(targetTop!.y);
    expect(arrBottom!.y).toBe(targetBottom!.y + targetBottom!.height);
    expect(arrLeft!.x + arrLeft!.width).toBe(targetLeft!.x);
    expect(arrRight!.x).toBe(targetRight!.x + targetRight!.width);
  });

  test("handles implicit sides derived from normalized coordinates nx/ny", async ({
    page,
  }) => {
    await open(page);

    const payload = {
      type: "archidraw/elements",
      elements: [
        {
          id: "db_implicit",
          type: "component",
          componentId: "sd-data-storage-relational-db",
          x: 300,
          y: 300,
        },
        {
          id: "arr_ny_top",
          type: "arrow",
          x: 350,
          y: 200,
          width: 0,
          height: 100,
          endBinding: { elementId: "db_implicit", nx: 0.5, ny: 0.1 },
        },
        {
          id: "arr_ny_bottom",
          type: "arrow",
          x: 350,
          y: 350,
          width: 0,
          height: 100,
          startBinding: { elementId: "db_implicit", nx: 0.5, ny: 0.9 },
        },
        {
          id: "arr_nx_left",
          type: "arrow",
          x: 200,
          y: 350,
          width: 100,
          height: 0,
          endBinding: { elementId: "db_implicit", nx: 0.1, ny: 0.5 },
        },
        {
          id: "arr_nx_right",
          type: "arrow",
          x: 350,
          y: 350,
          width: 100,
          height: 0,
          startBinding: { elementId: "db_implicit", nx: 0.9, ny: 0.5 },
        },
      ],
    };

    await pressPasteText(page, JSON.stringify(payload));

    const docElements = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );

    const arrows = docElements.filter((e: any) => e.type === "arrow");
    expect(arrows.length).toBe(4);

    const aTop = arrows.find((a: any) => a.endBinding && a.y < 300);
    const aBottom = arrows.find((a: any) => a.startBinding && a.y > 380);
    const aLeft = arrows.find((a: any) => a.endBinding && a.x < 300);
    const aRight = arrows.find((a: any) => a.startBinding && a.x > 400);

    expect(aTop?.endBinding?.side).toBe("top");
    expect(aBottom?.startBinding?.side).toBe("bottom");
    expect(aLeft?.endBinding?.side).toBe("left");
    expect(aRight?.startBinding?.side).toBe("right");
  });

  test("preserves unknown components and edges with bendPoints", async ({
    page,
  }) => {
    await open(page);

    const payload = {
      type: "archidraw/elements",
      elements: [
        {
          id: "comp_unknown",
          type: "component",
          componentId: "sd-non-existent-comp",
          x: 100,
          y: 100,
          width: 80,
          height: 80,
        },
        {
          id: "comp_valid",
          type: "component",
          componentId: "sd-data-storage-relational-db",
          x: 300,
          y: 100,
        },
        {
          id: "arr_routed",
          type: "arrow",
          lineType: "auto",
          x: 180,
          y: 140,
          width: 120,
          height: 0,
          bendPoints: [{ x: 240, y: 180 }],
          startBinding: { elementId: "comp_unknown", side: "right", nx: 1, ny: 0.5 },
          endBinding: { elementId: "comp_valid", side: "left", nx: 0, ny: 0.5 },
        },
      ],
    };

    await pressPasteText(page, JSON.stringify(payload));

    const docElements = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );

    const unknown = docElements.find((e: any) => e.type === "component");
    const routed = docElements.find((e: any) => e.type === "arrow");

    expect(unknown).toBeDefined();
    expect(unknown?.componentId).toBe("sd-non-existent-comp");
    expect(routed?.bendPoints).toEqual([{ x: 240, y: 180 }]);
  });

  test("pasting component with internal arrows remaps bindings cleanly without dangling references", async ({
    page,
  }) => {
    await open(page);

    const payload = [
      {
        id: "comp_gw",
        type: "component",
        componentId: "sd-infra-network-api-gateway",
        x: 200,
        y: 200,
        label: "API Gateway",
      },
    ];

    await pressPasteText(page, JSON.stringify(payload));

    const docElements = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );

    const allIds = new Set(docElements.map((e: any) => e.id));
    const arrows = docElements.filter((e: any) => e.type === "arrow");
    expect(arrows.length).toBeGreaterThan(0);

    for (const a of arrows) {
      if (a.startBinding) {
        expect(allIds.has(a.startBinding.elementId)).toBe(true);
      }
      if (a.endBinding) {
        expect(allIds.has(a.endBinding.elementId)).toBe(true);
      }
    }
  });
});
