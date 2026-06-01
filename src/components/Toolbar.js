import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from 'react';
import { canvasStore } from '../store/canvasStore';
import { exportToJSON, downloadFile } from '../utils/export';
import { importFromJSON, readFileAsText } from '../utils/import';
const TOOLS = [
    { type: 'rectangle', label: 'Rectangle', shortcut: 'R' },
    { type: 'circle', label: 'Circle', shortcut: 'C' },
    { type: 'diamond', label: 'Diamond', shortcut: 'D' },
    { type: 'triangle', label: 'Triangle', shortcut: 'T' },
    { type: 'line', label: 'Line', shortcut: 'L' },
    { type: 'arrow', label: 'Arrow', shortcut: 'A' },
    { type: 'text', label: 'Text', shortcut: 'X' },
];
export const Toolbar = () => {
    const currentTool = canvasStore((state) => state.currentTool);
    const setCurrentTool = canvasStore((state) => state.setCurrentTool);
    const shapes = canvasStore((state) => state.shapes);
    const setShapes = canvasStore((state) => state.setShapes);
    const fileInputRef = useRef(null);
    const handleExport = () => {
        const json = exportToJSON(shapes);
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const filename = `archidraw-${year}-${month}-${day}.archidraw`;
        downloadFile(json, filename);
    };
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };
    const handleFileSelected = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        try {
            const fileContent = await readFileAsText(file);
            const importedShapes = importFromJSON(fileContent);
            setShapes(importedShapes);
            alert('Project imported successfully!');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Import failed: ${errorMessage}`);
        }
        finally {
            // Reset file input value so the same file can be imported twice
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'row',
            gap: '8px',
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #ccc',
            alignItems: 'center',
        }, children: [_jsx("span", { style: { fontWeight: 'bold', marginRight: '8px' }, children: "Tools:" }), TOOLS.map((tool) => (_jsx("button", { onClick: () => setCurrentTool(tool.type), title: `${tool.label} (${tool.shortcut})`, style: {
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: currentTool === tool.type ? 'bold' : 'normal',
                    backgroundColor: currentTool === tool.type ? '#0066cc' : 'white',
                    color: currentTool === tool.type ? 'white' : 'black',
                    border: currentTool === tool.type ? 'none' : '1px solid #ccc',
                }, children: tool.label }, tool.type))), _jsx("button", { onClick: handleImportClick, title: "Import from .archidraw JSON", style: {
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    fontWeight: 'bold',
                    marginLeft: 'auto',
                }, children: "Import" }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".archidraw", onChange: handleFileSelected, style: { display: 'none' } }), _jsx("button", { onClick: handleExport, title: "Export to .archidraw JSON", style: {
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    fontWeight: 'bold',
                }, children: "Export" })] }));
};
