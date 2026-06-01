export function exportToJSON(shapes) {
    const doc = {
        version: '1.0',
        date: new Date().toISOString(),
        shapes,
    };
    return JSON.stringify(doc, null, 2);
}
export function downloadFile(content, filename) {
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
