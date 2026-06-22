import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[88px] w-full bg-bg px-3 py-2.5 text-sm text-text placeholder:text-3 border-2 border-border transition-all duration-150 hover:border-text-2 focus:border-text focus:shadow-[0_3px_0_0_#E5E5E5] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-disabled leading-relaxed resize-y',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
