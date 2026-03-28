import React, { useEffect } from 'react';
import { useToast, type Toast as ToastType } from '../../hooks/useToast';

const toastIcons: Record<ToastType['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const toastStyles: Record<ToastType['type'], string> = {
  success: 'border-success-500 bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-300',
  error: 'border-error-500 bg-error-50 dark:bg-error-500/10 text-error-700 dark:text-error-300',
  warning: 'border-warning-500 bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-300',
  info: 'border-secondary-500 bg-secondary-50 dark:bg-secondary-500/10 text-secondary-700 dark:text-secondary-300',
};

function Toast({ toast }: { toast: ToastType }) {
  const { removeToast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 shadow-lg bg-light-card dark:bg-dark-card
        ${toastStyles[toast.type]}
        animate-fade-in
      `}
    >
      <span className="text-lg">{toastIcons[toast.type]}</span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="btn-icon w-6 h-6"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
