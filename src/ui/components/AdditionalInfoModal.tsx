import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { editor } from "../hooks/useEditor";

export function AdditionalInfoModal({
  elementId,
  onClose,
}: {
  elementId: string;
  onClose: () => void;
}) {
  const [value, setValue] = useState(
    () => editor.getElement(elementId)?.details ?? "",
  );
  const taRef = useRef<HTMLTextAreaElement>(null);

  const save = () => {
    editor.updateElementDetails(elementId, value);
    onClose();
  };

  useEffect(() => {
    taRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!editor.getElement(elementId)) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="details-modal"
        role="dialog"
        aria-label="Additional Information"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="details-modal-header">
          <span>Additional Information</span>
          <button className="tool-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="details-modal-body">
          <textarea
            key={elementId}
            ref={taRef}
            className="details-modal-textarea"
            placeholder="Technical details… payload, latency, observations"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
              } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
          />
        </div>
        <div className="details-modal-footer">
          <button className="tool-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="tool-btn primary"
            data-testid="details-save"
            onClick={save}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}