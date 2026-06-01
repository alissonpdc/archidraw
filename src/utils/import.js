import { isValidShapeType } from '../types/shape';
export function importFromJSON(jsonString) {
    try {
        const doc = JSON.parse(jsonString);
        // Validate the document structure
        if (!doc.version || !Array.isArray(doc.shapes)) {
            throw new Error('Invalid .archidraw file format: missing version or shapes array');
        }
        // Validate each shape
        for (const shape of doc.shapes) {
            if (!isValidShapeType(shape.type)) {
                throw new Error(`Invalid shape type: ${shape.type}`);
            }
            if (!shape.id || typeof shape.x !== 'number' || typeof shape.y !== 'number') {
                throw new Error('Invalid shape: missing required properties');
            }
        }
        return doc.shapes;
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to import JSON: ${error.message}`);
        }
        throw new Error('Failed to import JSON: Unknown error');
    }
}
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === 'string') {
                resolve(content);
            }
            else {
                reject(new Error('Failed to read file as text'));
            }
        };
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        reader.readAsText(file);
    });
}
