import { describe, it, expect } from 'vitest';
import { importFromJSON } from '../utils/import';
import { exportToJSON } from '../utils/export';
import { CanvasDocument } from '../types/shape';

describe('Import Functions', () => {
  describe('importFromJSON', () => {
    it('should parse valid .archidraw JSON and return shapes', () => {
      const doc: CanvasDocument = {
        version: '1.0',
        date: '2026-05-31T10:00:00Z',
        shapes: [
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
        ],
      };
      const jsonString = JSON.stringify(doc);
      const shapes = importFromJSON(jsonString);

      expect(shapes).toHaveLength(2);
      expect(shapes[0].type).toBe('rectangle');
      expect(shapes[1].type).toBe('circle');
      expect(shapes[0].id).toBe('1');
      expect(shapes[1].id).toBe('2');
    });

    it('should handle empty shapes array', () => {
      const doc: CanvasDocument = {
        version: '1.0',
        date: '2026-05-31T10:00:00Z',
        shapes: [],
      };
      const jsonString = JSON.stringify(doc);
      const shapes = importFromJSON(jsonString);

      expect(shapes).toEqual([]);
      expect(Array.isArray(shapes)).toBe(true);
    });

    it('should throw on invalid JSON', () => {
      const invalidJson = 'not valid json {';
      expect(() => importFromJSON(invalidJson)).toThrow();
    });

    it('should support round-trip export and import', () => {
      const originalDoc: CanvasDocument = {
        version: '1.0',
        date: '2026-05-31T10:00:00Z',
        shapes: [
          {
            id: '1',
            type: 'rectangle',
            x: 10,
            y: 20,
            width: 100,
            height: 50,
            rotation: 0,
            text: 'Test',
            strokeColor: '#000000',
            strokeWidth: 2,
            fillColor: '#ffffff',
            createdAt: '2026-05-31T10:00:00Z',
          },
        ],
      };

      // Export the document
      const jsonString = exportToJSON(originalDoc.shapes);
      // Import it back
      const importedShapes = importFromJSON(jsonString);

      expect(importedShapes).toEqual(originalDoc.shapes);
      expect(importedShapes[0].type).toBe('rectangle');
      expect(importedShapes[0].text).toBe('Test');
    });
  });
});
