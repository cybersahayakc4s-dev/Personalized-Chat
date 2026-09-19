import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[var(--z-toast,100)] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map(t => {
        const isError = t.type === 'error';
        const isSuccess = t.type === 'success';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border flex items-start gap-3 transition-all animate-in slide-in-from-top-3 duration-200 bg-surface text-primary border-subtle ${
              isError
                ? 'border-l-4 border-l-danger'
                : isSuccess
                ? 'border-l-4 border-l-accent'
                : 'border-l-4 border-l-accent'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {isError ? (
                <AlertCircle className="w-5 h-5 text-danger" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-5 h-5 text-accent" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-accent-muted text-accent flex items-center justify-center">
                  <Info className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-body-sm font-semibold leading-tight">{t.title}</div>
              {t.description && (
                <div className="text-caption opacity-80 mt-0.5">{t.description}</div>
              )}
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    onDismiss(t.id);
                  }}
                  className="mt-2 text-caption font-semibold underline hover:opacity-80 transition-opacity flex items-center gap-1"
                >
                  {t.action.label}
                </button>
              )}
            </div>

            <button
              onClick={() => onDismiss(t.id)}
              className="p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
