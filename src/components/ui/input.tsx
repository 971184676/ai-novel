import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full bg-bg px-3 py-1 text-sm text-text placeholder:text-3 border-2 border-border transition-all duration-150 hover:border-text-2 focus:border-text focus:shadow-[0_3px_0_0_#E5E5E5] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-disabled',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
