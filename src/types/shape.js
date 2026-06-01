export function isValidShapeType(type) {
    const validTypes = ['rectangle', 'circle', 'diamond', 'triangle', 'line', 'arrow', 'text'];
    return validTypes.includes(type);
}
