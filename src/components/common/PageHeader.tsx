// =============================================================================
// PageHeader —— 通用页面标题区（标题 / 副标题 / 操作按钮 / Level 提示）
// =============================================================================

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** 顶部一行小字（如 "LEVEL 3 · 世界观搭建"） */
  eyebrow?: React.ReactNode;
  /** 页面主标题 */
  title: string;
  /** 副标题 / 描述 */
  subtitle?: React.ReactNode;
  /** 右上角操作按钮 */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * 通用页面标题区：eyebrow + title + subtitle + actions。
 * 严格对齐 design-brief：1px 下边线、白底、紧凑排版。
 */
export function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 sm:gap-6 pb-3 sm:pb-4 mb-4 sm:mb-6 border-b border-border',
        className,
      )}
    >
      <div className="min-w-0 w-full sm:w-auto">
        {eyebrow && (
          <div className="text-xs tnum text-3 mb-1.5 sm:mb-2 uppercase tracking-wider">{eyebrow}</div>
        )}
        <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-2 mt-1.5 sm:mt-2 max-w-sm sm:max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-1 sm:gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
