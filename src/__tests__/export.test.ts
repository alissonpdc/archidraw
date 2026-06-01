import { describe, it, expect, beforeEach } from 'vitest';
import { exportToJSON } from '../utils/export';
import { Shape, CanvasDocument } from '../types/shape';

describe('Export Functions', () => {
  let mockShapes: Shape[];

  beforeEach(() => {
    mockShapes = [
      {
        id: '1',
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0,
        text: '',
        strokeColor: '#000000',
        strokeWidth: 2,
        fillColor: '#ffffff',
        createdAt: '2026-05-31T10:00:00Z',
      },
      {
        id: '2',
        type: 'circle',
        x: 150,
        y: 50,
        width: 80,
        height: 80,
        rotation: 0,
        text: '',
        strokeColor: '#ff0000',
        strokeWidth: 1,
        fillColor: null,
        createdAt: '2026-05-31T10:05:00Z',
      },
    ];
  });

  describe('exportToJSON', () => {
    it('should export shapes to valid JSON string', () => {
      const json = exportToJSON(mockShapes);
      const parsed = JSON.parse(json) as CanvasDocument;

      expect(parsed.version).toBe('1.0');
      expect(parsed.date).toBeDefined();
      expect(parsed.shapes).toHaveLength(2);
      expect(parsed.shapes[0].type).toBe('rectangle');
    });

    it('should export multiple shapes with correct data', () => {
      const json = exportToJSON(mockShapes);
      const parsed = JSON.parse(json) as CanvasDocument;

      expect(parsed.shapes).toEqual(mockShapes);
      expect(parsed.shapes[0].id).toBe('1');
      expect(parsed.shapes[1].id).toBe('2');
    });

    it('should export empty shapes array', () => {
      const json = exportToJSON([]);
      const parsed = JSON.parse(json) as CanvasDocument;

      expect(parsed.shapes).toEqual([]);
      expect(parsed.version).toBe('1.0');
      expect(parsed.date).toBeDefined();
    });
  });

});
