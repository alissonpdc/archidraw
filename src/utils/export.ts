import { Shape, CanvasDocument } from '../types/shape';

export function exportToJSON(shapes: Shape[]): string {
  const doc: CanvasDocument = {
    version: '1.0',
    date: new Date().toISOString(),
    shapes,
  };
  return JSON.stringify(doc, null, 2);
}

export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
