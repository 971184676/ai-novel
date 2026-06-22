// =============================================================================
// StatStrip —— 顶部统计条（N 个等宽单元，1px 分隔）
// =============================================================================

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface StatItem {
  label: string;
  value: React.ReactNode;
  /** 副标题（小字辅助） */
  hint?: React.ReactNode;
  /** 该项前面是否要展示形状标记（如 ●■▲◆） */
  marker?: React.ReactNode;
}

export interface StatStripProps {
  items: StatItem[];
  columns?: number;
  className?: string;
}

/**
 * 等宽统计条：用 1px 灰线分隔各 cell，整条用 1px 灰线包裹。
 * 用于"总人数 / 主角 / 配角 / 反派"等紧凑指标。
 */
export function StatStrip({ items, columns, className }: StatStripProps) {
  const cols = columns ?? items.length;
  return (
    <div className={cn('grid bd', className)} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {items.map((it, i) => (
        <div
          key={i}
          className={cn(
            'p-4',
            i < items.length - 1 && 'border-r border-border',
          )}
        >
          <div className="text-xs tnum text-3 mb-2 flex items-center gap-2 uppercase tracking-wider">
            {it.marker}
            {it.label}
          </div>
          <div className="text-2xl font-semibold tnum">{it.value}</div>
          {it.hint && <div className="text-xs text-2 mt-1">{it.hint}</div>}
        </div>
      ))}
    </div>
  );
}
