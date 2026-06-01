import { describe, it, expect } from 'vitest';
import { Shape, ShapeType, isValidShapeType } from '../types/shape';

describe('Shape types', () => {
  it('should validate rectangle shape', () => {
    const rect: Shape = {
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
    expect(rect.type).toBe('rectangle');
    expect(rect.width).toBeGreaterThan(0);
  });

  it('should validate all shape types', () => {
    const types: ShapeType[] = ['rectangle', 'circle', 'diamond', 'triangle', 'line', 'arrow', 'text'];
    types.forEach(type => {
      expect(isValidShapeType(type)).toBe(true);
    });
  });

  it('should reject invalid shape types', () => {
    expect(isValidShapeType('invalid')).toBe(false);
  });
});
