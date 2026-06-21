'use client';

// Lightweight global toast system. Call toast.success('…') / toast.error('…')
// from anywhere; <Toaster/> (mounted once in the dashboard layout) renders them.
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

function emit(message: string, type: ToastType) {
  listeners.forEach((l) => l({ id: ++counter, message, type }));
}

export const toast = {
  success: (m: string) => emit(m, 'success'),
  error: (m: string) => emit(m, 'error'),
  info: (m: string) => emit(m, 'info'),
};

const ICONS = { success: CheckCircle2, error: XCircle, info: Info } as const;
const STYLES: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  error: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const add = (t: ToastItem) => {
      setItems((cur) => [...cur, t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 3800);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);
  const dismiss = (id: number) => setItems((cur) => cur.filter((x) => x.id !== id));

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              'animate-toast-in flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg',
              STYLES[t.type],
            )}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-60 transition hover:opacity-100">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
