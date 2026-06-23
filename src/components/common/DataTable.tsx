// =============================================================================
// DataTable —— 通用列表视图（带 header / 紧凑 row / hover 高亮 / 点击进入）
// 严格对齐 mockup 的 char-row / eq-row 风格。
// =============================================================================

import * as React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  /** 列的 key（仅用于 React key） */
  key: string;
  /** 表头文本（不填则不渲染表头 cell） */
  header?: React.ReactNode;
  /** 列宽度（CSS 值），可空 */
  width?: string;
  /** 自定义类名 */
  className?: string;
  /** 渲染该列内容 */
  render: (item: T, index: number) => React.ReactNode;
  /** 在移动端是否隐藏 */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  items: T[];
  columns: DataTableColumn<T>[];
  /** 行点击 */
  onRowClick?: (item: T) => void;
  /** 行唯一 key */
  rowKey: (item: T) => React.Key;
  /** 表头是否 sticky */
  stickyHeader?: boolean;
  className?: string;
  /** 每行前面的可选图标列（如装备 lucide 图标） */
  rowIcon?: (item: T) => LucideIcon | null;
  /** 不使用 ChevronRight（默认带） */
  noChevron?: boolean;
}

export function DataTable<T>({
  items,
  columns,
  onRowClick,
  rowKey,
  stickyHeader = false,
  className,
  rowIcon,
  noChevron,
}: DataTableProps<T>) {
  // 计算 grid template（桌面端）
  const cols: string[] = [];
  if (rowIcon) cols.push('24px');
  columns.forEach((c) => cols.push(c.width ?? '1fr'));
  if (onRowClick && !noChevron) cols.push('20px');
  const gridTemplate = cols.join(' ');

  // 计算移动端 grid template
  const mobileCols: string[] = [];
  if (rowIcon) mobileCols.push('24px');
  columns.forEach((c) => {
    if (!c.hideOnMobile) {
      mobileCols.push(c.width ?? '1fr');
    }
  });
  if (onRowClick && !noChevron) mobileCols.push('20px');
  const mobileGridTemplate = mobileCols.join(' ');

  return (
    <div className={cn('bd overflow-x-auto', className)}>
      {/* header */}
      <div
        className={cn(
          'grid items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 text-xs font-medium uppercase tracking-wider text-2 border-b border-text bg-bg',
          stickyHeader && 'sticky top-0',
        )}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {rowIcon && <div aria-hidden />}
        {columns.map((c) => (
          <div key={c.key} className={cn(c.className, c.hideOnMobile && 'hidden sm:block')}>
            {c.header}
          </div>
        ))}
        {onRowClick && !noChevron && <div aria-hidden />}
      </div>

      {/* rows */}
      {items.map((item, idx) => {
        const Icon = rowIcon?.(item);
        const interactive = Boolean(onRowClick);
        const content = (
          <>
            {rowIcon && (
              <div className="flex items-center justify-center">
                {Icon ? <Icon className="w-3.5 sm:w-4 h-3.5 sm:h-4" strokeWidth={1.5} /> : null}
              </div>
            )}
            {columns.map((c) => (
              <div key={c.key} className={cn(c.className, c.hideOnMobile && 'hidden sm:block')}>
                {c.render(item, idx)}
              </div>
            ))}
            {interactive && !noChevron && (
              <div className="flex items-center justify-end text-3">
                <ChevronRight className="w-3.5 sm:w-4 h-3.5 sm:h-4" strokeWidth={1.5} />
              </div>
            )}
          </>
        );
        return (
          <div
            key={rowKey(item)}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? () => onRowClick?.(item) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick?.(item);
                    }
                  }
                : undefined
            }
            className={cn(
              'grid items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border last:border-b-0 transition-colors',
              interactive && 'hover:bg-surface cursor-pointer',
            )}
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
