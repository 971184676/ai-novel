// =============================================================================
// FilterTabs —— 扁平化筛选标签条（白底黑边 / 黑底白字 = 选中）
// =============================================================================

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FilterTabItem<T extends string = string> {
  /** 唯一 key */
  value: T;
  /** 显示文本 */
  label: React.ReactNode;
  /** 计数（可选） */
  count?: number;
}

export interface FilterTabsProps<T extends string = string> {
  items: FilterTabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

/**
 * 扁平化筛选 tab 组：1px 灰边、hover 变黑边、active 黑底白字。
 * 用于"全部 / 主角 / 配角 / 反派 / NPC"等枚举过滤。
 */
export function FilterTabs<T extends string = string>({
  items,
  value,
  onChange,
  className,
}: FilterTabsProps<T>) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              'inline-flex items-center h-8 px-3 text-sm border-2 font-semibold transition-all select-none',
              active
                ? 'bg-bg text-text border-text shadow-[0_2px_0_0_#000] -translate-y-0.5'
                : 'bg-bg text-text border-border shadow-[0_2px_0_0_#E5E5E5] hover:border-text hover:-translate-y-0.5 hover:shadow-[0_3px_0_0_#E5E5E5] active:translate-y-[1px] active:shadow-[0_1px_0_0_#E5E5E5]',
            )}
          >
            {it.label}
            {typeof it.count === 'number' && (
              <span
                className={cn(
                  'ml-1.5 text-xs tnum',
                  active ? 'opacity-80' : 'text-2',
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 用于在 tabs 之间插入一条垂直分隔 */
export function FilterDivider() {
  return <div className="w-px h-4 bg-border mx-1" aria-hidden />;
}
