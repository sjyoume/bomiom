import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 3000); // 3초 뒤 자동 삭제
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const bgColors = {
    success: 'bg-gray-900 text-white',
    error: 'bg-rose-500 text-white',
    info: 'bg-blue-500 text-white'
  };

  const icons = {
    success: <CheckCircle size={18} className="text-emerald-400" />,
    error: <AlertCircle size={18} className="text-white" />,
    info: <Info size={18} className="text-white" />
  };

  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl transform transition-all duration-500 hover:scale-105 animate-slide-up mb-3 min-w-[300px] justify-between ${bgColors[toast.type]}`}>
      <div className="flex items-center gap-3">
        {icons[toast.type]}
        <span className="text-sm font-bold tracking-wide">{toast.message}</span>
      </div>
      <button onClick={() => onRemove(toast.id)} className="opacity-70 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC<{ toasts: ToastMessage[], onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center pointer-events-none">
      <div className="pointer-events-auto">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
};