export type ShapeType = 'rectangle' | 'circle' | 'diamond' | 'triangle' | 'line' | 'arrow' | 'text';

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text: string;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string | null;
  createdAt: string;
}

export function isValidShapeType(type: unknown): type is ShapeType {
  const validTypes: ShapeType[] = ['rectangle', 'circle', 'diamond', 'triangle', 'line', 'arrow', 'text'];
  return validTypes.includes(type as ShapeType);
}

export interface CanvasDocument {
  version: string;
  date: string;
  shapes: Shape[];
}
