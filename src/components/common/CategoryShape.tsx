// =============================================================================
// CategoryShape —— 角色 / 阵营 / 立场 用几何形状（无颜色）
// 圆=主角 / 方=配角 / 三角=反派 / 菱=NPC
// 正方形=正道 / 菱形=中立 / 三角=邪道
// =============================================================================

import * as React from 'react';
import { cn } from '@/lib/utils';

export type CategoryShapeKind = 'protagonist' | 'supporting' | 'villain' | 'npc';

export const CATEGORY_LABELS: Record<CategoryShapeKind, string> = {
  protagonist: '主角',
  supporting: '配角',
  villain: '反派',
  npc: 'NPC',
};

export function CategoryShape({
  kind,
  size = 12,
  className,
}: {
  kind: CategoryShapeKind;
  size?: number;
  className?: string;
}) {
  if (kind === 'protagonist') {
    return (
      <span
        className={cn('inline-block bg-text', className)}
        style={{ width: size, height: size, borderRadius: '50%' }}
        aria-label={CATEGORY_LABELS[kind]}
        title={CATEGORY_LABELS[kind]}
      />
    );
  }
  if (kind === 'supporting') {
    return (
      <span
        className={cn('inline-block bg-text', className)}
        style={{ width: size, height: size }}
        aria-label={CATEGORY_LABELS[kind]}
        title={CATEGORY_LABELS[kind]}
      />
    );
  }
  if (kind === 'villain') {
    return (
      <span
        className={cn('inline-block', className)}
        style={{
          width: 0,
          height: 0,
          background: 'transparent',
          borderLeft: `${size / 2}px solid transparent`,
          borderRight: `${size / 2}px solid transparent`,
          borderBottom: `${(size * 5) / 6}px solid #000000`,
        }}
        aria-label={CATEGORY_LABELS[kind]}
        title={CATEGORY_LABELS[kind]}
      />
    );
  }
  // npc — diamond
  return (
    <span
      className={cn('inline-block border-text', className)}
      style={{
        width: size - 2,
        height: size - 2,
        background: 'transparent',
        border: '1.5px solid #000000',
        transform: 'rotate(45deg)',
      }}
      aria-label={CATEGORY_LABELS[kind]}
      title={CATEGORY_LABELS[kind]}
    />
  );
}
