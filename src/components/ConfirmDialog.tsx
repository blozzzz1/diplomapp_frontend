import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger — красная кнопка подтверждения (удаление и т.п.) */
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  const confirmClass =
    variant === 'danger'
      ? 'bg-red-500/90 text-white hover:bg-red-600 border border-red-400/30'
      : 'bg-primary-500 text-white hover:bg-primary-600 border border-primary-400/30';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-primary-900/40 bg-background-card shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4 p-6">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              variant === 'danger' ? 'bg-red-500/15 text-red-400' : 'bg-primary-500/15 text-primary-400'
            }`}
          >
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            <p id="confirm-dialog-desc" className="mt-2 text-sm leading-relaxed text-gray-400">
              {message}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-primary-900/30 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl border border-primary-900/40 bg-background-hover px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-background-darker sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors sm:w-auto ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
