import { useEffect, useRef, useState } from "react";
import { editor, useEditor } from "../hooks/useEditor";
import { type RenderColors, componentIconLayout } from "../../core/renderer";
import { useGridMode } from "../viewPrefs";
import type { Point } from "../../core/types";
import { pushRecentComponent } from "../../core/library";
import { COMPONENT_DND_TYPE } from "./LibraryPanel";
import { resolveTextColor } from "../../core/textStyle";
import { measureText, edgeLabelAnchor } from "../../core/utils";

function readThemeColors(): RenderColors & { elementStroke: string } {
  const style = getComputedStyle(document.documentElement);
  return {
    selection: style.getPropertyValue("--selection-color").trim() || "#6965db",
    elementStroke: style.getPropertyValue("--element-stroke").trim() || "#1e1e1e",
    gridDot: style.getPropertyValue("--grid-dot").trim() || "rgba(0,0,0,0.14)",
    gridLine: style.getPropertyValue("--grid-line").trim() || "rgba(0,0,0,0.07)",
    // label plates must always match the live canvas background
    canvasBg: style.getPropertyValue("--bg-canvas").trim() || "#ffffff",
  };
}

export function CanvasHost() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fakeCaretRef = useRef<HTMLDivElement>(null);
  const fakeSelectionRef = useRef<HTMLDivElement>(null);
  const snap = useEditor();
  const gridMode = useGridMode();
  const [colors, setColors] = useState(readThemeColors);

  // re-read canvas colors when theme changes
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(readThemeColors()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let raf = 0;
    const resizeAndRender = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (
        canvas.width !== Math.round(rect.width * dpr) ||
        canvas.height !== Math.round(rect.height * dpr)
      ) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      editor.renderTo(ctx, rect.width, rect.height, {
        colors,
        gridMode,
      });
      raf = requestAnimationFrame(resizeAndRender);
    };
    raf = requestAnimationFrame(resizeAndRender);
    return () => cancelAnimationFrame(raf);
  }, [colors, gridMode]);

  // auto-resize textarea to fit content (no visible box, just cursor)
  const autoResize = (ta: HTMLTextAreaElement) => {
    ta.style.height = "auto";
    ta.style.width = "auto";
    ta.style.height = ta.scrollHeight + "px";
    ta.style.width = ta.scrollWidth + 1 + "px";
  };

  // focus text overlay when editing starts (synchronous, avoids typing races);
  // selects existing text so double-click enters edit mode with text selected
  useEffect(() => {
    if (snap.editingTextId) {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.select();
      }
    }
  }, [snap.editingTextId]);

  // non-passive native wheel listener (React's onWheel is passive)
  useEffect(() => {
    const canvas = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      editor.wheel({ x: e.clientX, y: e.clientY }, { x: e.deltaX, y: e.deltaY }, e.ctrlKey || e.metaKey);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const toPoint = (e: React.PointerEvent | React.MouseEvent): Point => ({
    x: e.clientX,
    y: e.clientY,
  });

  const editingEl =
    snap.editingTextId && snap.doc.elements.find((el) => el.id === snap.editingTextId);
  const cam = snap.camera;
  const isEditingText = !!editingEl && editingEl.type === "text";
  const isEditingLabel =
    !!editingEl && editingEl.type !== "text" && snap.editingKind === "label";
  const grabCursor =
    snap.tool === "hand" || (editor.isSpacePressed() && snap.tool !== "text");

  // fake-caret + fake-selection: blink/position update while editing free text
  // or a label. The overlay textarea is invisible — the canvas renders the
  // text with the final style at all times; we track caret & selection pixels.
  // Line geometry mirrors the canvas renderer exactly (drawLabel / text branch)
  useEffect(() => {
    const ta = textareaRef.current;
    const caret = fakeCaretRef.current;
    if (!ta || !caret || !editingEl) return;
    const editing =
      editingEl.type === "text" ? isEditingText : isEditingLabel;
    if (!editing) return;

    const themeColors: RenderColors = {
      selection: "#6965db",
      elementStroke: colors.elementStroke,
      gridDot: colors.gridDot,
      gridLine: colors.gridLine,
      canvasBg: colors.canvasBg,
    };

    let lastSelKey = "";

    const update = () => {
      const value = ta.value;
      const zoom = cam.zoom;
      const lh = editingEl.lineSpacing ?? 1.25;
      const lines = value.split("\n");

      // --- per-line geometry in scene units: left edge + top of em box ---
      let fontSize: number;
      const leftEdges: number[] = [];
      const tops: number[] = [];

      if (editingEl.type === "text") {
        // mirror the free-text drawing branch of drawElement
        const el = editingEl;
        fontSize = el.fontSize;
        const align = el.textAlign ?? "left";
        const n = lines.length;
        const textBlockH =
          n === 1 ? fontSize : (n - 1) * fontSize * lh + fontSize;
        const vOffset = Math.max(0, (el.height - textBlockH) / 2);
        for (let i = 0; i < n; i++) {
          const lw = measureText(lines[i], fontSize, el.fontFamily, el.bold, el.italic).width;
          leftEdges.push(
            align === "left" ? el.x :
            align === "right" ? el.x + el.width - lw :
            el.x + el.width / 2 - lw / 2,
          );
          tops.push(el.y + vOffset + i * fontSize * lh);
        }
      } else {
        // mirror drawLabel for shape labels
        const el = editingEl;
        let hx: number;
        let cy: number;
        let align: "left" | "center" | "right";
        let vAlignMode: "top" | "middle" | "bottom";
        if (el.type === "component") {
          const layout = componentIconLayout(el);
          fontSize = layout.labelFont;
          hx = layout.labelCx;
          cy = layout.labelCy;
          align = "center";
          vAlignMode = "middle"; // component captions are always centered
        } else {
          align = el.textAlign ?? "center";
          vAlignMode = el.textVAlign ?? "middle";
          fontSize = el.fontSize ?? 14;
          if (el.type === "line" || el.type === "arrow") {
            // edges: label slides along the stroke (labelT, default center)
            const anchor = edgeLabelAnchor(el)!;
            hx = anchor.x;
            cy = anchor.y;
          } else {
            const pad = el.textPadding ?? 8;
            if (align === "left") hx = el.x + pad;
            else if (align === "right") hx = el.x + el.width - pad;
            else hx = el.x + el.width / 2;
            if (vAlignMode === "top") cy = el.y + pad;
            else if (vAlignMode === "bottom") cy = el.y + el.height - pad;
            else cy = el.y + el.height / 2;
          }
        }
        const step = fontSize * lh;
        for (let i = 0; i < lines.length; i++) {
          const lw = measureText(lines[i], fontSize, el.fontFamily, el.bold, el.italic).width;
          leftEdges.push(
            align === "center" ? hx - lw / 2 :
            align === "right" ? hx - lw : hx,
          );
          const midY =
            vAlignMode === "top" ? cy + i * step :
            vAlignMode === "bottom" ? cy + (i - (lines.length - 1)) * step :
            cy + i * step - ((lines.length - 1) * step) / 2;
          tops.push(midY - fontSize / 2);
        }
      }

      const fontOf = (s: string) =>
        measureText(s, fontSize, editingEl.fontFamily, editingEl.bold, editingEl.italic);

      const offsetToPos = (off: number): { li: number; col: number } => {
        let rem = Math.max(0, Math.min(off, value.length));
        for (let i = 0; i < lines.length; i++) {
          if (rem <= lines[i].length) return { li: i, col: rem };
          rem -= lines[i].length + 1;
        }
        return { li: lines.length - 1, col: lines[lines.length - 1].length };
      };
      const xOfCol = (li: number, col: number) =>
        leftEdges[li] + fontOf(lines[li].slice(0, col)).width;

      // --- fake caret at selectionStart ---
      const cPos = offsetToPos(ta.selectionStart ?? 0);
      caret.style.left = `${xOfCol(cPos.li, cPos.col) * zoom + cam.scrollX}px`;
      caret.style.top = `${tops[cPos.li] * zoom + cam.scrollY}px`;
      caret.style.height = `${fontSize * zoom}px`;
      caret.style.color = resolveTextColor(editingEl, themeColors);

      // --- fake selection rects between selectionStart..selectionEnd ---
      const selHost = fakeSelectionRef.current;
      if (!selHost) return;
      const a = ta.selectionStart ?? 0;
      const b = ta.selectionEnd ?? a;
      const key = `${Math.min(a, b)}:${Math.max(a, b)}:${value}:${cam.zoom}`;
      if (key !== lastSelKey) {
        lastSelKey = key;
        selHost.replaceChildren();
        if (a !== b) {
          const s = offsetToPos(Math.min(a, b));
          const e = offsetToPos(Math.max(a, b));
          let li = s.li;
          let col = s.col;
          while (li <= e.li && li < lines.length) {
            const endCol = li === e.li ? e.col : lines[li].length;
            if (endCol > col) {
              const rect = document.createElement("div");
              rect.className = "fake-selection-rect";
              rect.style.left = `${xOfCol(li, col) * zoom + cam.scrollX}px`;
              rect.style.top = `${tops[li] * zoom + cam.scrollY}px`;
              rect.style.width = `${(xOfCol(li, endCol) - xOfCol(li, col)) * zoom}px`;
              rect.style.height = `${fontSize * zoom}px`;
              selHost.appendChild(rect);
            }
            li++;
            col = 0;
          }
        }
      }
    };

    update();
    const id = setInterval(update, 80);
    return () => clearInterval(id);
  }, [isEditingText, isEditingLabel, editingEl, cam, colors]);

  // label overlay sits at the rendered label position (below the icon
  // for components), so editing is truly in-place
  let labelPos: Point | null = null;
  let labelFontSize = 14;
  if (isEditingLabel && editingEl) {
    if (editingEl.type === "component") {
      const layout = componentIconLayout(editingEl);
      labelPos = {
        x: layout.labelCx * cam.zoom + cam.scrollX,
        y: layout.labelCy * cam.zoom + cam.scrollY,
      };
      labelFontSize = layout.labelFont * cam.zoom;
    } else if (editingEl.type === "line" || editingEl.type === "arrow") {
      const anchor = edgeLabelAnchor(editingEl)!;
      labelPos = {
        x: anchor.x * cam.zoom + cam.scrollX,
        y: anchor.y * cam.zoom + cam.scrollY,
      };
    } else {
      labelPos = {
        x: (editingEl.x + editingEl.width / 2) * cam.zoom + cam.scrollX,
        y: (editingEl.y + editingEl.height / 2) * cam.zoom + cam.scrollY,
      };
    }
  }

  return (
    <div
      className="canvas-host"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(COMPONENT_DND_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(COMPONENT_DND_TYPE);
        if (!id) return;
        e.preventDefault();
        editor.insertComponent(id, { x: e.clientX, y: e.clientY });
        pushRecentComponent(id);
      }}
    >
      <canvas
        ref={canvasRef}
        data-tool={snap.tool}
        className={`canvas ${grabCursor ? "cursor-grab" : ""}`}
        onPointerDown={(e) => {
          if (isEditingText || isEditingLabel) {
            textareaRef.current?.focus();
            return;
          }
          // prevent the browser's focus-stealing default action when the
          // click creates a text element (otherwise it blurs the new overlay)
          if (snap.tool === "text") e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          editor.pointerDown(toPoint(e), e.button, {
            shift: e.shiftKey,
            defaultStroke: colors.elementStroke,
          });
        }}
        onPointerMove={(e) => {
          const p = toPoint(e);
          editor.pointerMove(p, { shift: e.shiftKey });
          // imperative resize-handle cursor (avoids re-renders on hover)
          const override = editor.cursorOverrideAt(p);
          e.currentTarget.style.cursor = override ?? "";
        }}
        onPointerUp={() => {
          if (isEditingText || isEditingLabel) return;
          editor.pointerUp();
        }}
        onDoubleClick={(e) => {
          if (isEditingText || isEditingLabel) return;
          if (snap.tool === "text") return; // tool click already created one
          editor.pointerDoubleClick(toPoint(e));
        }}
      />
      {snap.doc.elements.length === 0 && !snap.hasDraft && !isEditingText && !isEditingLabel && (
        <div className="empty-state" aria-hidden="true">
          <svg
            className="empty-art"
            width="120"
            height="72"
            viewBox="0 0 120 72"
            fill="none"
          >
            <rect x="4" y="10" width="44" height="28" rx="4" stroke="var(--text-muted)" strokeWidth="1.5" />
            <text x="26" y="27" textAnchor="middle" fontSize="8" fill="var(--text-muted)">API</text>
            <rect x="72" y="10" width="44" height="28" rx="4" stroke="var(--text-muted)" strokeWidth="1.5" />
            <text x="94" y="27" textAnchor="middle" fontSize="8" fill="var(--text-muted)">DB</text>
            <path d="M48 24 C 60 24, 60 24, 72 24" stroke="var(--accent)" strokeWidth="1.5" />
            <path d="M68 20 L 72 24 L 68 28" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
            <rect x="38" y="52" width="44" height="16" rx="3" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="3 3" />
          </svg>
          <div className="empty-title">Canvas vazio — clique e arraste para criar</div>
          <div className="empty-keys">
            <span><kbd>R</kbd> retângulo</span>
            <span><kbd>A</kbd> seta</span>
            <span><kbd>T</kbd> texto</span>
            <span><kbd>?</kbd> atalhos</span>
          </div>
        </div>
      )}
      {((isEditingText && editingEl.type === "text") || isEditingLabel) && (
        <div ref={fakeSelectionRef} className="fake-selection" />
      )}
      {((isEditingText && editingEl.type === "text") || isEditingLabel) && (
        <div ref={fakeCaretRef} className="fake-caret" />
      )}
      {isEditingText && editingEl.type === "text" && (() => {
        return (
          <textarea
            ref={textareaRef}
            className="text-overlay"
            spellCheck={false}
            style={{
              left: editingEl.x * cam.zoom + cam.scrollX,
              top: editingEl.y * cam.zoom + cam.scrollY,
              width: editingEl.width * cam.zoom,
              height: editingEl.height * cam.zoom,
              fontSize: editingEl.fontSize * cam.zoom,
              fontFamily: editingEl.fontFamily || '"Segoe UI", system-ui, sans-serif',
              fontWeight: editingEl.bold ? "bold" : "normal",
              fontStyle: editingEl.italic ? "italic" : "normal",
              textDecoration: editingEl.underline ? "underline" : "none",
              lineHeight: String(editingEl.lineSpacing ?? 1.25),
              textAlign: editingEl.textAlign ?? "left",
              paddingTop: (() => { const n = editingEl.text.split("\n").length; const lh = editingEl.lineSpacing ?? 1.25; const tbh = n === 1 ? editingEl.fontSize : (n - 1) * editingEl.fontSize * lh + editingEl.fontSize; return Math.max(0, (editingEl.height - tbh) / 2) * cam.zoom; })(),
            }}
            value={editingEl.text}
            onChange={(e) => {
              editor.updateText(editingEl.id, e.target.value);
            }}
            onBlur={() => {
              editor.finishTextEdit();
              editor.clearSelection();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
          />
        );
      })()}
      {isEditingLabel && editingEl && labelPos && (() => {
        return (
          <textarea
            ref={textareaRef}
            className="text-overlay label-overlay"
            spellCheck={false}
            style={{
              left: labelPos.x,
              top: labelPos.y,
              fontSize: labelFontSize,
              fontFamily: editingEl.fontFamily || '"Segoe UI", system-ui, sans-serif',
              fontWeight: editingEl.bold ? "bold" : "normal",
              fontStyle: editingEl.italic ? "italic" : "normal",
              lineHeight: String(editingEl.lineSpacing ?? 1.25),
            }}
            value={editingEl.label ?? ""}
            onChange={(e) => {
              editor.updateLabel(editingEl.id, e.target.value);
              autoResize(e.target as HTMLTextAreaElement);
            }}
            onBlur={() => {
              editor.finishTextEdit();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
          />
        );
      })()}
    </div>
  );
}
