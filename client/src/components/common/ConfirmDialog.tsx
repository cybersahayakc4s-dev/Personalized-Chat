import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button when opened for immediate keyboard accessibility
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && !isLoading) {
        // Only confirm on Enter if target is not the cancel button
        if (document.activeElement?.getAttribute('data-dialog-action') !== 'cancel') {
          e.preventDefault();
          onConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onConfirm, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-[var(--surface-card,#18181b)] border border-[var(--border-medium,#27272a)] p-6 shadow-2xl text-[var(--text-primary,#fafafa)] transition-all animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className={`p-2.5 rounded-xl flex-shrink-0 ${
              isDestructive
                ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
            }`}
          >
            {isDestructive ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="text-base font-semibold tracking-tight text-[var(--text-primary,#fafafa)]">
              {title}
            </h3>
            <div id="confirm-dialog-description" className="mt-1.5 text-sm text-[var(--text-secondary,#a1a1aa)] leading-relaxed">
              {description}
            </div>
          </div>
          <button
            onClick={onCancel}
            data-dialog-action="cancel"
            className="p-1 rounded-lg text-[var(--text-muted,#71717a)] hover:text-[var(--text-primary,#fafafa)] hover:bg-[var(--surface-hover,#27272a)] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <button
            type="button"
            data-dialog-action="cancel"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--border-medium,#27272a)] bg-[var(--surface-card,#18181b)] hover:bg-[var(--surface-hover,#27272a)] text-[var(--text-secondary,#a1a1aa)] hover:text-[var(--text-primary,#fafafa)] transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            data-dialog-action="confirm"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all shadow-sm flex items-center gap-2 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
