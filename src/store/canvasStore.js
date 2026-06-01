import { create } from 'zustand';
export const canvasStore = create((set) => ({
    shapes: [],
    currentTool: 'rectangle',
    viewport: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
    },
    addShape: (shape) => set((state) => ({
        shapes: [...state.shapes, shape],
    })),
    setCurrentTool: (tool) => set({
        currentTool: tool,
    }),
    clearShapes: () => set({
        shapes: [],
    }),
    setShapes: (shapes) => set({
        shapes,
    }),
    setViewport: (viewport) => set({
        viewport,
    }),
}));
