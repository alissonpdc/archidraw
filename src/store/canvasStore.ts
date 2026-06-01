import { create } from 'zustand';
import { Shape, ShapeType } from '../types/shape';

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface CanvasState {
  shapes: Shape[];
  currentTool: ShapeType;
  viewport: Viewport;
  addShape: (shape: Shape) => void;
  setCurrentTool: (tool: ShapeType) => void;
  clearShapes: () => void;
  setShapes: (shapes: Shape[]) => void;
  setViewport: (viewport: Viewport) => void;
}

export const canvasStore = create<CanvasState>((set) => ({
  shapes: [],
  currentTool: 'rectangle',
  viewport: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },

  addShape: (shape: Shape) =>
    set((state) => ({
      shapes: [...state.shapes, shape],
    })),

  setCurrentTool: (tool: ShapeType) =>
    set({
      currentTool: tool,
    }),

  clearShapes: () =>
    set({
      shapes: [],
    }),

  setShapes: (shapes: Shape[]) =>
    set({
      shapes,
    }),

  setViewport: (viewport: Viewport) =>
    set({
      viewport,
    }),
}));
