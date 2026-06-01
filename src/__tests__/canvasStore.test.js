import { describe, it, expect, beforeEach } from 'vitest';
import { canvasStore } from '../store/canvasStore';
describe('Canvas Store', () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        canvasStore.getState().clearShapes();
        canvasStore.setState({ currentTool: 'rectangle' });
    });
    it('should initialize with empty shapes and rectangle tool', () => {
        const state = canvasStore.getState();
        expect(state.shapes).toEqual([]);
        expect(state.currentTool).toBe('rectangle');
        expect(state.viewport).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
    });
    it('should add a shape', () => {
        const newShape = {
            id: 'shape-1',
            type: 'rectangle',
            x: 100,
            y: 100,
            width: 200,
            height: 150,
            rotation: 0,
            text: '',
            strokeColor: '#000000',
            strokeWidth: 2,
            fillColor: '#FFFFFF',
            createdAt: new Date().toISOString(),
        };
        canvasStore.getState().addShape(newShape);
        const state = canvasStore.getState();
        expect(state.shapes).toHaveLength(1);
        expect(state.shapes[0]).toEqual(newShape);
    });
    it('should set current tool', () => {
        canvasStore.getState().setCurrentTool('circle');
        expect(canvasStore.getState().currentTool).toBe('circle');
        canvasStore.getState().setCurrentTool('line');
        expect(canvasStore.getState().currentTool).toBe('line');
    });
    it('should clear shapes', () => {
        const shape1 = {
            id: 'shape-1',
            type: 'rectangle',
            x: 100,
            y: 100,
            width: 200,
            height: 150,
            rotation: 0,
            text: '',
            strokeColor: '#000000',
            strokeWidth: 2,
            fillColor: '#FFFFFF',
            createdAt: new Date().toISOString(),
        };
        const shape2 = {
            id: 'shape-2',
            type: 'circle',
            x: 300,
            y: 300,
            width: 100,
            height: 100,
            rotation: 0,
            text: '',
            strokeColor: '#000000',
            strokeWidth: 2,
            fillColor: '#FF0000',
            createdAt: new Date().toISOString(),
        };
        canvasStore.getState().addShape(shape1);
        canvasStore.getState().addShape(shape2);
        expect(canvasStore.getState().shapes).toHaveLength(2);
        canvasStore.getState().clearShapes();
        expect(canvasStore.getState().shapes).toHaveLength(0);
    });
    it('should set viewport', () => {
        const store = canvasStore.getState();
        store.setViewport({ scale: 2, offsetX: 100, offsetY: 200 });
        const state = canvasStore.getState();
        expect(state.viewport.scale).toBe(2);
        expect(state.viewport.offsetX).toBe(100);
        expect(state.viewport.offsetY).toBe(200);
    });
    it('should set shapes (for import)', () => {
        const newShapes = [
            {
                id: 'shape-1',
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                rotation: 0,
                text: '',
                strokeColor: '#000000',
                strokeWidth: 2,
                fillColor: '#FFFFFF',
                createdAt: new Date().toISOString(),
            },
            {
                id: 'shape-2',
                type: 'circle',
                x: 300,
                y: 300,
                width: 100,
                height: 100,
                rotation: 0,
                text: '',
                strokeColor: '#000000',
                strokeWidth: 2,
                fillColor: '#FF0000',
                createdAt: new Date().toISOString(),
            },
        ];
        canvasStore.getState().setShapes(newShapes);
        const state = canvasStore.getState();
        expect(state.shapes).toHaveLength(2);
        expect(state.shapes).toEqual(newShapes);
    });
});
