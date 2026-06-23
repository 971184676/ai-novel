// =============================================================================
// ResourcePage —— 通用 CRUD 页面骨架
// 不绑定具体实体。提供：
//   - 顶部：PageHeader
//   - 顶部：StatStrip（可选）
//   - 筛选区：FilterTabs + Search（可选）
//   - 主体：children（list view）
//   - FAB / Topbar 按钮 → 打开"创建"对话框
// 6 个模块都基于此组件实现。
// =============================================================================

import * as React from 'react';
import { Plus, Search, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from './PageHeader';
import { StatStrip, type StatItem } from './StatStrip';
import { FilterTabs, type FilterTabItem } from './FilterTabs';
import { cn } from '@/lib/utils';

export interface ResourcePageProps<TFilter extends string = string> {
  /** 顶部 eyebrow（如 "LEVEL 3 · 世界观搭建"） */
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  /** 顶部右上角按钮：用于"新建 XXX"等 */
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** 额外的顶部按钮（导出/导入 等） */
  secondaryActions?: React.ReactNode;
  /** 顶部统计条 */
  stats?: StatItem[];
  /** 筛选 tabs */
  filters?: {
    items: FilterTabItem<TFilter>[];
    value: TFilter;
    onChange: (v: TFilter) => void;
  };
  /** 搜索框 */
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  /** 列表区 / 内容区 */
  children: React.ReactNode;
  /** 空状态 */
  emptyState?: React.ReactNode;
  /** 当前是否为空（外部控制：list 数量 = 0 且无搜索/过滤） */
  empty?: boolean;
  /** 页面最大宽度 */
  maxWidthClassName?: string;
}

/**
 * 通用 CRUD 页面骨架。所有 6 个模块都用这个组件。
 * 不直接拉数据（保持纯展示），数据获取由 useLiveQuery + 业务页负责。
 */
export function ResourcePage<TFilter extends string = string>({
  eyebrow,
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  stats,
  filters,
  search,
  children,
  emptyState,
  empty = false,
  maxWidthClassName,
}: ResourcePageProps<TFilter>) {
  const PrimaryIcon = primaryAction?.icon ?? Plus;

  return (
    <div className={cn('w-full', maxWidthClassName ?? 'max-w-4xl sm:max-w-5xl lg:max-w-7xl')}>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {secondaryActions}
            {primaryAction && (
              <Button type="button" size="sm" variant="primary" onClick={primaryAction.onClick}>
                <PrimaryIcon className="w-3 h-3" strokeWidth={1.5} />
                {primaryAction.label}
              </Button>
            )}
          </>
        }
      />

      {stats && stats.length > 0 && <StatStrip items={stats} className="mb-4 sm:mb-6" />}

      {(filters || search) && (
        <div className="flex items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            {filters && <FilterTabs items={filters.items} value={filters.value} onChange={filters.onChange} />}
          </div>
          {search && (
            <div className="relative w-full sm:w-auto sm:w-48 lg:w-56">
              <Search
                className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 text-3 pointer-events-none"
                strokeWidth={1.5}
              />
              <Input
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? '搜索…'}
                className="pl-7 sm:pl-8"
              />
            </div>
          )}
        </div>
      )}

      {empty && emptyState ? emptyState : children}
    </div>
  );
}

/** 简单空状态组件（用于 6 个模块） */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bd border-dashed py-16 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 border border-border flex items-center justify-center mb-4">
        <Plus className="w-4 h-4 text-3" strokeWidth={1.5} />
      </div>
      <h3 className="text-md font-medium mb-1.5">{title}</h3>
      {hint && <p className="text-sm text-2 max-w-sm leading-relaxed mb-6">{hint}</p>}
      {action}
    </div>
  );
}
