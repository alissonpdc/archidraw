import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface ConfirmRequest {
  label: string;
  title?: string;
  message?: string;
  details?: string;
  onConfirm: () => void;
  onSaveAndClose?: () => void | Promise<void>;
}

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
        {confirm.title && (
          <h3 className="tab-confirm-title" data-testid="ws-confirm-title">
            {confirm.title}
          </h3>
        )}
        <div className="tab-confirm-body">
          {confirm.message && (
            <p className="tab-confirm-text tab-confirm-warning">
              {confirm.message}
            </p>
          )}
          {confirm.details && (
            <p className="tab-confirm-text tab-confirm-details">
              {confirm.details}
            </p>
          )}
        </div>
        <div className="tab-confirm-actions">
          <button
            type="button"
            className="menu-item tab-confirm-btn"
            data-testid="ws-confirm-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          {confirm.onSaveAndClose && (
            <button
              type="button"
              className="menu-item tab-confirm-btn primary"
              data-testid="ws-confirm-save"
              onClick={async () => {
                const action = confirm.onSaveAndClose;
                onCancel();
                if (action) await action();
              }}
            >
              Save & close
            </button>
          )}
          <button
            type="button"
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
