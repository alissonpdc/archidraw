import { useEffect, useRef, useState } from "react";
import { editor, useEditor } from "../hooks/useEditor";
import { type RenderColors, componentIconLayout } from "../../core/renderer";
import { useGridMode } from "../viewPrefs";
import type { Point } from "../../core/types";
import { pushRecentComponent } from "../../core/library";
import { COMPONENT_DND_TYPE } from "./LibraryPanel";
import { resolveTextColor } from "../../core/textStyle";

function readThemeColors(): RenderColors & { elementStroke: string } {
  const style = getComputedStyle(document.documentElement);
  return {
    selection: style.getPropertyValue("--selection-color").trim() || "#6965db",
    elementStroke: style.getPropertyValue("--element-stroke").trim() || "#1e1e1e",
    gridDot: style.getPropertyValue("--grid-dot").trim() || "rgba(0,0,0,0.14)",
    gridLine: style.getPropertyValue("--grid-line").trim() || "rgba(0,0,0,0.07)",
  };
}

export function CanvasHost() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
          if (isEditingText || isEditingLabel) return;
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
          editor.pointerMove(p);
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
      {isEditingText && editingEl.type === "text" && (() => {
        const themeColors: RenderColors = {
          selection: "#6965db",
          elementStroke: colors.elementStroke,
          gridDot: colors.gridDot,
          gridLine: colors.gridLine,
        };
        return (
          <textarea
            ref={textareaRef}
            className="text-overlay"
            style={{
              left: editingEl.x * cam.zoom + cam.scrollX,
              top: editingEl.y * cam.zoom + cam.scrollY,
              fontSize: editingEl.fontSize * cam.zoom,
              fontFamily: editingEl.fontFamily || '"Segoe UI", system-ui, sans-serif',
              fontWeight: editingEl.bold ? "bold" : "normal",
              fontStyle: editingEl.italic ? "italic" : "normal",
              textDecoration: editingEl.underline ? "underline" : "none",
              lineHeight: String(editingEl.lineSpacing ?? 1.25),
              color: resolveTextColor(editingEl, themeColors),
              textAlign: editingEl.textAlign ?? "left",
            }}
            value={editingEl.text}
            onChange={(e) => editor.updateText(editingEl.id, e.target.value)}
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
        const themeColors: RenderColors = {
          selection: "#6965db",
          elementStroke: colors.elementStroke,
          gridDot: colors.gridDot,
          gridLine: colors.gridLine,
        };
        return (
          <textarea
            ref={textareaRef}
            className="text-overlay label-overlay"
            style={{
              left: labelPos.x,
              top: labelPos.y,
              fontSize: labelFontSize,
              fontFamily: editingEl.fontFamily || '"Segoe UI", system-ui, sans-serif',
              fontWeight: editingEl.bold ? "bold" : "normal",
              fontStyle: editingEl.italic ? "italic" : "normal",
              textDecoration: editingEl.underline ? "underline" : "none",
              lineHeight: String(editingEl.lineSpacing ?? 1.25),
              color: resolveTextColor(editingEl, themeColors),
            }}
            value={editingEl.label ?? ""}
            onChange={(e) => editor.updateLabel(editingEl.id, e.target.value)}
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
