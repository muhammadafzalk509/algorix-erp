import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'success';
}) {
  const variants: Record<string, string> = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    outline:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">{children}</label>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">{children}</h3>;
}

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-sky-100 text-sky-700',
    rose: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', map[color])}>
      {children}
    </span>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-900/50">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-top text-slate-700 dark:text-slate-300', className)}>{children}</td>;
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  const color =
    s === 'ACTIVE' || s === 'PAID' || s === 'APPROVED' || s === 'DONE' || s === 'RESOLVED' || s === 'COMPLETED'
      ? 'green'
      : s === 'PENDING' || s === 'TODO' || s === 'OPEN' || s === 'NEW' || s === 'PLANNING'
        ? 'amber'
        : s === 'REJECTED' || s === 'OVERDUE' || s === 'CANCELLED' || s === 'CLOSED'
          ? 'rose'
          : 'blue';
  return <Badge color={color}>{status}</Badge>;
}

/* ------------------------------- Modal / Dialog ---------------------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="animate-fade-in fixed inset-0 z-[150] grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'animate-pop-in max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-800',
          wide ? 'max-w-2xl' : 'max-w-md',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </Modal>
  );
}
