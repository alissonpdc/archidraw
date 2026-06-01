import React from 'react';
import { canvasStore } from '../store/canvasStore';
import { ShapeType } from '../types/shape';
import { exportToJSON, downloadFile } from '../utils/export';

interface Tool {
  type: ShapeType;
  label: string;
  shortcut: string;
}

const TOOLS: Tool[] = [
  { type: 'rectangle', label: 'Rectangle', shortcut: 'R' },
  { type: 'circle', label: 'Circle', shortcut: 'C' },
  { type: 'diamond', label: 'Diamond', shortcut: 'D' },
  { type: 'triangle', label: 'Triangle', shortcut: 'T' },
  { type: 'line', label: 'Line', shortcut: 'L' },
  { type: 'arrow', label: 'Arrow', shortcut: 'A' },
  { type: 'text', label: 'Text', shortcut: 'X' },
];

export const Toolbar: React.FC = () => {
  const currentTool = canvasStore((state) => state.currentTool);
  const setCurrentTool = canvasStore((state) => state.setCurrentTool);
  const shapes = canvasStore((state) => state.shapes);

  const handleExport = () => {
    const json = exportToJSON(shapes);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const filename = `archidraw-${year}-${month}-${day}.archidraw`;
    downloadFile(json, filename);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '8px',
        padding: '12px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ccc',
        alignItems: 'center',
      }}
    >
      <span style={{ fontWeight: 'bold', marginRight: '8px' }}>Tools:</span>
      {TOOLS.map((tool) => (
        <button
          key={tool.type}
          onClick={() => setCurrentTool(tool.type)}
          title={`${tool.label} (${tool.shortcut})`}
          style={{
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: currentTool === tool.type ? 'bold' : 'normal',
            backgroundColor: currentTool === tool.type ? '#0066cc' : 'white',
            color: currentTool === tool.type ? 'white' : 'black',
            border: currentTool === tool.type ? 'none' : '1px solid #ccc',
          }}
        >
          {tool.label}
        </button>
      ))}
      <button
        onClick={handleExport}
        title="Export to .archidraw JSON"
        style={{
          padding: '6px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          fontWeight: 'bold',
          marginLeft: 'auto',
        }}
      >
        Export
      </button>
    </div>
  );
};
