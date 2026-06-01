import { describe, it, expect, beforeEach } from 'vitest';
import { ShapeRenderer } from '../utils/shapeRenderer';
describe('ShapeRenderer', () => {
    let canvas;
    let renderer;
    beforeEach(() => {
        // Create a mock canvas element
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        renderer = new ShapeRenderer(canvas);
    });
    it('should initialize with a canvas element', () => {
        expect(renderer).toBeDefined();
        expect(renderer).toBeInstanceOf(ShapeRenderer);
    });
    it('should render a rectangle shape', () => {
        const rect = {
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
        expect(() => renderer.drawShape(rect, 1, 0, 0)).not.toThrow();
    });
    it('should clear the canvas', () => {
        expect(() => renderer.clear()).not.toThrow();
    });
});
