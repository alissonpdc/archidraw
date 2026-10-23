import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface ConfirmRequest {
  label: string;
  message: string;
  onConfirm: () => void;
}

/**
 * destructive-action confirmation using the shared `.tab-confirm*` styling.
 * Cancel/Escape/backdrop dismiss; Escape is intercepted with capture so it
 * wins over the panel's shortcut handlers.
 *
 * Usage: <ConfirmModal confirm={req} onCancel={...} />
 */
export function ConfirmModal({
  confirm,
  onCancel,
}: {
  confirm: ConfirmRequest;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [confirm, onCancel]);

  return createPortal(
    <div
      className="modal-backdrop tab-confirm-backdrop"
      data-testid="ws-confirm"
      onClick={onCancel}
    >
      <div
        className="tab-confirm"
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="tab-confirm-text">{confirm.message}</p>
        <div className="tab-confirm-actions">
          <button
            className="menu-item tab-confirm-btn"
            data-testid="ws-confirm-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="menu-item tab-confirm-btn danger"
            data-testid="ws-confirm-btn"
            onClick={() => {
              const action = confirm.onConfirm;
              onCancel();
              action();
            }}
          >
            {confirm.label}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
