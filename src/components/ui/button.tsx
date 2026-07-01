import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Button —— 游戏感立体按钮（白底黑字 / 浮雕阴影 / 按压反馈）
 * 注意：所有 variant 都是「白底黑字 + 黑色硬阴影」，hover 时只换 bg + 浮起，
 *        不再反色（之前 hover:bg-text + hover:text-bg 会因为 text-bg 类不存在
 *        导致黑底黑字看不见）。
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text select-none',
  {
    variants: {
      variant: {
        default:
          'bg-bg text-text border-2 border-text shadow-[0_5px_0_0_#000] hover:-translate-y-1 hover:shadow-[0_7px_0_0_#000] hover:bg-surface active:translate-y-[4px] active:shadow-[0_1px_0_0_#000]',
        primary:
          'bg-bg text-text border-2 border-text shadow-[0_5px_0_0_#000] hover:-translate-y-1 hover:shadow-[0_7px_0_0_#000] hover:bg-surface active:translate-y-[4px] active:shadow-[0_1px_0_0_#000]',
        ghost:
          'bg-bg text-text border-2 border-border shadow-[0_4px_0_0_#E5E5E5] hover:-translate-y-1 hover:shadow-[0_5px_0_0_#000] hover:border-text hover:bg-surface active:translate-y-[3px] active:shadow-[0_1px_0_0_#E5E5E5]',
        destructive:
          'bg-bg text-text border-2 border-text shadow-[0_5px_0_0_#000] hover:-translate-y-1 hover:shadow-[0_7px_0_0_#000] hover:bg-surface active:translate-y-[4px] active:shadow-[0_1px_0_0_#000]',
        link: 'bg-transparent border-transparent underline-offset-4 hover:underline px-0 h-auto shadow-none hover:-translate-y-0 active:translate-y-0',
      },
      size: {
        default: 'h-10 px-5 text-sm',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 px-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
