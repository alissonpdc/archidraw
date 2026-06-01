import { describe, it, expect } from 'vitest';
import { createShape, calculateAspectRatio, maintainAspectRatio } from '../utils/shapeFactory';
describe('Shape Factory', () => {
    it('should create rectangle shape', () => {
        const shape = createShape('rectangle', 10, 20, 100, 80);
        expect(shape.type).toBe('rectangle');
        expect(shape.x).toBe(10);
        expect(shape.y).toBe(20);
        expect(shape.width).toBe(100);
        expect(shape.height).toBe(80);
        expect(shape.id).toBeDefined();
        expect(shape.createdAt).toBeDefined();
    });
    it('should create all shape types', () => {
        const types = ['rectangle', 'circle', 'diamond', 'triangle', 'line', 'arrow', 'text'];
        types.forEach((type) => {
            const shape = createShape(type, 0, 0, 100, 100);
            expect(shape.type).toBe(type);
            if (type === 'line' || type === 'arrow') {
                expect(shape.fillColor).toBeNull();
            }
            else {
                expect(shape.fillColor).toBe('#FFFFFF');
            }
        });
    });
    it('should calculate aspect ratio correctly', () => {
        const ratio = calculateAspectRatio(100, 80);
        expect(ratio).toBe(1.25);
    });
    it('should maintain aspect ratio for constrained shapes', () => {
        // Circle: should be square
        expect(maintainAspectRatio(100, 80, 'circle')).toEqual({ width: 80, height: 80 });
        // Rectangle: should be square
        expect(maintainAspectRatio(100, 80, 'rectangle')).toEqual({ width: 80, height: 80 });
        // Triangle: should be square
        expect(maintainAspectRatio(100, 80, 'triangle')).toEqual({ width: 80, height: 80 });
        // Diamond: should be square
        expect(maintainAspectRatio(100, 80, 'diamond')).toEqual({ width: 80, height: 80 });
        // Line: no constraint
        expect(maintainAspectRatio(100, 80, 'line')).toEqual({ width: 100, height: 80 });
        // Arrow: no constraint
        expect(maintainAspectRatio(100, 80, 'arrow')).toEqual({ width: 100, height: 80 });
        // Text: no constraint
        expect(maintainAspectRatio(100, 80, 'text')).toEqual({ width: 100, height: 80 });
    });
});
