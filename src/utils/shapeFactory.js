import { v4 as uuidv4 } from 'uuid';
export function createShape(type, x, y, width, height, text = '') {
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
export function calculateAspectRatio(width, height) {
    return width / (height || 1);
}
export function maintainAspectRatio(width, height, type) {
    // Shapes that require square aspect ratio
    const SQUARE_SHAPES = new Set(['circle', 'rectangle', 'triangle', 'diamond']);
    if (SQUARE_SHAPES.has(type)) {
        const size = Math.min(Math.abs(width), Math.abs(height));
        return { width: size, height: size };
    }
    // Line, Arrow, Text: no aspect ratio constraint
    return { width, height };
}
