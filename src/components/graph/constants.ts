import { Circle, Square, Diamond, Triangle } from 'lucide-react';
import type { BuiltInModuleDef } from './types';

export const BUILTIN_MODULES: BuiltInModuleDef[] = [
  { key: 'character', label: '人物', iconChar: '●', IconComponent: Circle },
  { key: 'faction', label: '势力', iconChar: '◆', IconComponent: Diamond },
  { key: 'region', label: '地域', iconChar: '■', IconComponent: Square },
  { key: 'sect', label: '宗门', iconChar: '▲', IconComponent: Triangle },
];

export const CATEGORY_PRESETS: { key: string; label: string; color: string }[] = [
  { key: '', label: '未分类', color: '#A3A3A3' },
  { key: '正派', label: '正派', color: '#3B6B3B' },
  { key: '邪派', label: '邪派', color: '#8B2E2E' },
  { key: '中立', label: '中立', color: '#8B7332' },
  { key: '主角', label: '主角', color: '#000000' },
  { key: '关键', label: '关键', color: '#2E4A6B' },
  { key: '边缘', label: '边缘', color: '#8B8B8B' },
];

export const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1 };

export const PRO_OPTIONS = { hideAttribution: true };

export const DEFAULT_EDGE_OPTIONS = { type: 'relation' };

export const DELETE_KEY_CODES = ['Delete', 'Backspace'];