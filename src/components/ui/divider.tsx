import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Divider —— 极简 1px 横线，对齐设计 token
 */
export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-border', className)} />;
}

export function DividerStrong({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-text', className)} />;
}
