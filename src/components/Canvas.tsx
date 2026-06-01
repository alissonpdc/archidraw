import React, { useRef, useEffect, useState } from 'react';
import { canvasStore } from '../store/canvasStore';
import { ShapeRenderer } from '../utils/shapeRenderer';
import { createShape, maintainAspectRatio } from '../utils/shapeFactory';
import { ShapeType } from '../types/shape';

interface DrawState {
  isDrawing: boolean;
  startX: number;
  startY: number;
}

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ShapeRenderer | null>(null);
  const drawStateRef = useRef<DrawState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
  });

  const shapes = canvasStore((state) => state.shapes);
  const currentTool = canvasStore((state) => state.currentTool);
  const addShape = canvasStore((state) => state.addShape);
  const setCurrentTool = canvasStore((state) => state.setCurrentTool);
  const viewport = canvasStore((state) => state.viewport);

  const [canvasSize, setCanvasSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 60,
  });

  // Initialize canvas and renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    try {
      rendererRef.current = new ShapeRenderer(canvas);
    } catch (error) {
      console.error('Failed to initialize ShapeRenderer:', error);
    }

    // Set up render loop
    let animationFrameId: number;

    const render = () => {
      if (!rendererRef.current) return;

      // Clear canvas
      rendererRef.current.clear();

      // Draw all shapes
      shapes.forEach((shape) => {
        rendererRef.current!.drawShape(shape, viewport.scale, viewport.offsetX, viewport.offsetY);
      });

      // Request next frame
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [shapes, viewport.scale, viewport.offsetX, viewport.offsetY, canvasSize]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight - 50,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get canvas coordinates from viewport coordinates
  const getCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - viewport.offsetX) / viewport.scale;
    const y = (clientY - rect.top - viewport.offsetY) / viewport.scale;

    return { x, y };
  };

  // Handle mouse down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    drawStateRef.current.isDrawing = true;
    drawStateRef.current.startX = coords.x;
    drawStateRef.current.startY = coords.y;
  };

  // Handle mouse move
  const handleMouseMove = () => {
    if (!drawStateRef.current.isDrawing) return;

    // Preview can be implemented here later
    // For now, minimal implementation as specified
  };

  // Handle mouse up
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawStateRef.current.isDrawing) return;

    drawStateRef.current.isDrawing = false;

    const coords = getCanvasCoords(e.clientX, e.clientY);
    const width = coords.x - drawStateRef.current.startX;
    const height = coords.y - drawStateRef.current.startY;

    // Ignore clicks without meaningful drag (< 2px in both dimensions)
    if (Math.abs(width) < 2 || Math.abs(height) < 2) {
      return;
    }

    // Apply aspect ratio constraint if Shift key is held
    let finalWidth = width;
    let finalHeight = height;

    if (e.shiftKey) {
      const { width: constrainedWidth, height: constrainedHeight } = maintainAspectRatio(
        width,
        height,
        currentTool
      );
      finalWidth = constrainedWidth;
      finalHeight = constrainedHeight;
    }

    // Create shape - handle negative drag (right-to-left, bottom-to-top)
    const x = width < 0 ? drawStateRef.current.startX + width : drawStateRef.current.startX;
    const y = height < 0 ? drawStateRef.current.startY + height : drawStateRef.current.startY;

    const shape = createShape(currentTool, x, y, Math.abs(finalWidth), Math.abs(finalHeight));
    addShape(shape);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    drawStateRef.current.isDrawing = false;
  };

  // Handle keyboard events for tool selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const toolMap: Record<string, ShapeType> = {
        r: 'rectangle',
        c: 'circle',
        d: 'diamond',
        t: 'triangle',
        l: 'line',
        a: 'arrow',
        x: 'text',
      };

      const tool = toolMap[e.key.toLowerCase()];
      if (tool) {
        setCurrentTool(tool);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCurrentTool]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        cursor: drawStateRef.current.isDrawing ? 'crosshair' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
};
