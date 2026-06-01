import { Shape } from '../types/shape';

export class ShapeRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;
  }

  clear(): void {
    const canvas = this.ctx.canvas;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawShape(shape: Shape, scale: number, offsetX: number, offsetY: number): void {
    const x = shape.x * scale + offsetX;
    const y = shape.y * scale + offsetY;
    const w = shape.width * scale;
    const h = shape.height * scale;

    switch (shape.type) {
      case 'rectangle':
        this.drawRectangle(x, y, w, h, shape.fillColor);
        break;
      case 'circle':
        this.drawCircle(x + w / 2, y + h / 2, Math.min(w, h) / 2, shape.fillColor);
        break;
      case 'diamond':
        this.drawDiamond(x, y, w, h, shape.fillColor);
        break;
      case 'triangle':
        this.drawTriangle(x, y, w, h, shape.fillColor);
        break;
      case 'line':
        this.drawLine(x, y, x + w, y + h);
        break;
      case 'arrow':
        this.drawArrow(x, y, x + w, y + h);
        break;
      case 'text':
        this.drawText(x, y, shape.text);
        break;
    }
  }

  private drawRectangle(x: number, y: number, w: number, h: number, fillColor: string | null): void {
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, w, h);
    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(x, y, w, h);
    }
  }

  private drawCircle(cx: number, cy: number, r: number, fillColor: string | null): void {
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    this.ctx.stroke();
    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }
  }

  private drawDiamond(x: number, y: number, w: number, h: number, fillColor: string | null): void {
    const cx = x + w / 2;
    const cy = y + h / 2;
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, y); // top
    this.ctx.lineTo(x + w, cy); // right
    this.ctx.lineTo(cx, y + h); // bottom
    this.ctx.lineTo(x, cy); // left
    this.ctx.closePath();
    this.ctx.stroke();
    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }
  }

  private drawTriangle(x: number, y: number, w: number, h: number, fillColor: string | null): void {
    const cx = x + w / 2;
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, y); // top
    this.ctx.lineTo(x + w, y + h); // bottom right
    this.ctx.lineTo(x, y + h); // bottom left
    this.ctx.closePath();
    this.ctx.stroke();
    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number): void {
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  private drawArrow(x1: number, y1: number, x2: number, y2: number): void {
    const headlen = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // Draw line
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    // Draw arrowhead
    this.ctx.beginPath();
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    this.ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawText(x: number, y: number, text: string): void {
    this.ctx.fillStyle = '#000000';
    this.ctx.font = '14px system-ui';
    this.ctx.fillText(text, x, y + 14);
  }
}
