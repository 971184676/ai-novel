// =============================================================================
// CharacterShape —— 角色分类的几何形状（圆/方/三角/菱形）
// 与 mockup/characters.html 中 ●■▲◆ 对应
// =============================================================================

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CharacterCategory } from '@/db/types';

export const CHARACTER_CATEGORY_LABELS: Record<CharacterCategory, string> = {
  protagonist: '主角',
  supporting: '配角',
  villain: '反派',
  npc: 'NPC',
};

export const CHARACTER_CATEGORY_OPTIONS = (
  Object.keys(CHARACTER_CATEGORY_LABELS) as CharacterCategory[]
).map((v) => ({ value: v, label: CHARACTER_CATEGORY_LABELS[v] }));

export function CharacterShape({
  kind,
  size = 12,
  className,
}: {
  kind: CharacterCategory;
  size?: number;
  className?: string;
}) {
  // 圆 = 主角
  if (kind === 'protagonist') {
    return (
      <span
        className={cn('inline-block bg-text', className)}
        style={{ width: size, height: size, borderRadius: '50%' }}
        aria-label={CHARACTER_CATEGORY_LABELS[kind]}
        title={CHARACTER_CATEGORY_LABELS[kind]}
      />
    );
  }
  // 方 = 配角
  if (kind === 'supporting') {
    return (
      <span
        className={cn('inline-block bg-text', className)}
        style={{ width: size, height: size }}
        aria-label={CHARACTER_CATEGORY_LABELS[kind]}
        title={CHARACTER_CATEGORY_LABELS[kind]}
      />
    );
  }
  // 三角 = 反派
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
        aria-label={CHARACTER_CATEGORY_LABELS[kind]}
        title={CHARACTER_CATEGORY_LABELS[kind]}
      />
    );
  }
  // 菱形 = NPC
  return (
    <span
      className={cn('inline-block', className)}
      style={{
        width: size - 2,
        height: size - 2,
        background: 'transparent',
        border: '1.5px solid #000000',
        transform: 'rotate(45deg)',
      }}
      aria-label={CHARACTER_CATEGORY_LABELS[kind]}
      title={CHARACTER_CATEGORY_LABELS[kind]}
    />
  );
}
