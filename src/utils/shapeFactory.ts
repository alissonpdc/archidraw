import { v4 as uuidv4 } from 'uuid';
import { Shape, ShapeType } from '../types/shape';

export function createShape(
  type: ShapeType,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string = ''
): Shape {
  const isFillable = type !== 'line' && type !== 'arrow';

  return {
    id: uuidv4(),
    type,
    x,
    y,
    width: Math.max(0, width),
    height: Math.max(0, height),
    rotation: 0,
    text,
    strokeColor: '#000000',
    strokeWidth: 2,
    fillColor: isFillable ? '#FFFFFF' : null,
    createdAt: new Date().toISOString(),
  };
}

export function calculateAspectRatio(width: number, height: number): number {
  return width / (height || 1);
}

export function maintainAspectRatio(
  width: number,
  height: number,
  type: ShapeType
): { width: number; height: number } {
  // Shapes that require square aspect ratio
  const SQUARE_SHAPES = new Set(['circle', 'rectangle', 'triangle', 'diamond']);

  if (SQUARE_SHAPES.has(type)) {
    const size = Math.min(Math.abs(width), Math.abs(height));
    return { width: size, height: size };
  }

  // Line, Arrow, Text: no aspect ratio constraint
  return { width, height };
}
