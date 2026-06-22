// =============================================================================
// novel-creator · 全局 Toast hook
// 基于 Radix Toast primitive。
// 暴露简单 API：useToaster().show({ title, description, variant })
// =============================================================================

import * as React from 'react';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type ToastVariant = 'default' | 'success' | 'error' | 'warning';

interface ToastItem {
  id: number;
  title?: string;
  description?: string;
  variant: ToastVariant;
  /** 自动关闭毫秒，默认 4000；设为 0 不自动关 */
  duration?: number;
}

interface ToasterContextValue {
  show: (opts: {
    title?: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToasterContext = React.createContext<ToasterContextValue | null>(null);

export function useToaster(): ToasterContextValue {
  const ctx = React.useContext(ToasterContext);
  if (!ctx) {
    throw new Error('useToaster 必须在 <ToasterProvider> 内部使用');
  }
  return ctx;
}

/**
 * 全局 Toast Provider：放在 App 顶层。
 * 使用方式：
 *   const toaster = useToaster();
 *   toaster.success('保存成功');
 *   toaster.error('出错了', '详情');
 */
export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const show = React.useCallback<ToasterContextValue['show']>(
    ({ title, description, variant = 'default', duration = 4000 }) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, title, description, variant, duration }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const success = React.useCallback(
    (title: string, description?: string) =>
      show({ title, description, variant: 'success' }),
    [show],
  );
  const error = React.useCallback(
    (title: string, description?: string) =>
      show({ title, description, variant: 'error', duration: 6000 }),
    [show],
  );
  const warning = React.useCallback(
    (title: string, description?: string) =>
      show({ title, description, variant: 'warning' }),
    [show],
  );

  const value = React.useMemo<ToasterContextValue>(
    () => ({ show, success, error, warning, dismiss }),
    [show, success, error, warning, dismiss],
  );

  return (
    <ToasterContext.Provider value={value}>
      <ToastProvider swipeDirection="right">
        {children}
        {items.map((it) => (
          <Toast
            key={it.id}
            onOpenChange={(open) => {
              if (!open) dismiss(it.id);
            }}
            duration={it.duration ?? 4000}
            className={cn(
              'data-[state=open]:slide-in-from-right-full',
              it.variant === 'success' && 'border-l-4 border-l-text',
              it.variant === 'error' && 'border-l-4 border-l-[#333]',
              it.variant === 'warning' && 'border-l-4 border-l-[#666]',
            )}
          >
            <div className="flex flex-col gap-1">
              {it.title && <ToastTitle>{it.title}</ToastTitle>}
              {it.description && <ToastDescription>{it.description}</ToastDescription>}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToasterContext.Provider>
  );
}
