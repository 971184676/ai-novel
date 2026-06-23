// Minimal toast primitive — wrapped around Radix Toast for simple usage.
import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ToastProvider = ToastPrimitive.Provider;

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(
      'border border-text bg-bg p-4 grid grid-cols-[1fr_auto] gap-2 items-center',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80',
      className,
    )}
    {...props}
  />
));
Toast.displayName = ToastPrimitive.Root.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn('text-sm font-semibold', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn('text-xs text-2', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn('opacity-70 hover:opacity-100', className)}
    {...props}
  >
    <X className="h-4 w-4" strokeWidth={1.5} />
  </ToastPrimitive.Close>
));
ToastClose.displayName = ToastPrimitive.Close.displayName;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn('fixed top-4 right-4 z-[100] flex max-h-screen w-96 flex-col gap-2', className)}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

export {
  ToastProvider,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastViewport,
};
