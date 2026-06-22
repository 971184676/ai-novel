import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-1 h-6 px-2.5 text-xs font-semibold border transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-bg text-text border-text shadow-[0_2px_0_0_#000]',
        solid: 'bg-bg text-text border-text shadow-[0_2px_0_0_#000]',
        outline: 'bg-bg text-text border-text',
        dashed: 'bg-bg text-2 border-dashed border-text-2',
        muted: 'bg-bg text-3 border-border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// 章节状态徽章快捷组件
export function StatusBadge({
  status,
}: {
  status: 'outline' | 'expanded' | 'edited' | 'final';
}) {
  const map = {
    outline: { variant: 'muted' as const, label: '构思大纲' },
    expanded: { variant: 'dashed' as const, label: '扩展内容' },
    edited: { variant: 'outline' as const, label: '精细编辑' },
    final: { variant: 'solid' as const, label: '最终定稿' },
  };
  const { variant, label } = map[status];
  return (
    <Badge variant={variant} className="tnum">
      {label}
    </Badge>
  );
}
