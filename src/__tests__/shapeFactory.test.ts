import { describe, it, expect } from 'vitest';
import { createShape, calculateAspectRatio } from '../utils/shapeFactory';

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
    const types = ['rectangle', 'circle', 'diamond', 'triangle', 'line', 'arrow', 'text'] as const;
    types.forEach((type) => {
      const shape = createShape(type, 0, 0, 100, 100);
      expect(shape.type).toBe(type);
      if (type === 'line' || type === 'arrow') {
        expect(shape.fillColor).toBeNull();
      } else {
        expect(shape.fillColor).toBe('#FFFFFF');
      }
    });
  });

  it('should calculate aspect ratio correctly', () => {
    const ratio = calculateAspectRatio(100, 80);
    expect(ratio).toBe(1.25);
  });
});
