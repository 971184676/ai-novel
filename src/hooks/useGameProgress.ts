// =============================================================================
// novel-creator · 游戏化 Level 进度计算
// 对应 开发文档 第十二节：6 级 Level 系统
//
// 实时订阅 Dexie 的 useLiveQuery，新增数据后进度自动更新。
// 返回值包含：
//   - levels: 6 个 Level 的 { level, name, completed, current } 状态
//   - counts: 各表行数（用于 BookOverview 的"模块状态"卡片）
//   - completedCount / totalCount: 完成数（用于进度条百分比）
//
// 注：地图功能已并入关系网，原 L3「绘世」已移除；现共 6 关。
// =============================================================================

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { wordCount } from '@/lib/utils';
import type { GameProgress, LevelConfig } from '@/db/types';

export const LEVELS: LevelConfig[] = [
  { level: 1, name: '开局构思', description: '填写世界名称和背景', target: 1 },
  { level: 2, name: '角色入库', description: '创建至少 3 个人物', target: 3 },
  { level: 3, name: '世界观搭建', description: '定义至少 3 个境界', target: 3 },
  { level: 4, name: '体系完善', description: '创建至少 2 个阵营', target: 2 },
  { level: 5, name: '正式更新', description: '完成至少 3 个章节大纲', target: 3 },
  { level: 6, name: '完本撒花', description: '所有章节达到 final 状态', target: 1 },
];

/** 单个 Level 的进度信息（用于 UI） */
export interface LevelProgress {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  description: string;
  target: number;
  /** 当前数量（用作细粒度进度，0~target 之间） */
  current: number;
  /** 是否完成 */
  completed: boolean;
  /** 是否为当前 Level（第一个未完成项） */
  currentLevel: boolean;
}

/** 各模块计数（用于 BookOverview 的模块卡片） */
export interface BookCounts {
  world: number;
  characters: number;
  relationships: number;
  regions: number;
  locations: number;
  cultivationLevels: number;
  equipment: number;
  skills: number;
  factions: number;
  chapters: number;
  chaptersFinal: number;
  chaptersOutline: number;
  totalWords: number;
}

export interface GameProgressResult {
  levels: LevelProgress[];
  counts: BookCounts;
  completedCount: number;
  totalCount: number; // 恒为 6
  percent: number; // 0~100
}

const EMPTY_COUNTS: BookCounts = {
  world: 0,
  characters: 0,
  relationships: 0,
  regions: 0,
  locations: 0,
  cultivationLevels: 0,
  equipment: 0,
  skills: 0,
  factions: 0,
  chapters: 0,
  chaptersFinal: 0,
  chaptersOutline: 0,
  totalWords: 0,
};

/**
 * Hook: 实时查询当前书籍的 Level 进度 + 各模块计数。
 * @param bookId 当前书籍 id，null 时返回空数据（用于首页等无 bookId 场景）。
 */
export function useGameProgress(bookId: number | null): GameProgressResult | undefined {
  return useLiveQuery(async (): Promise<GameProgressResult> => {
    if (bookId == null) {
      return buildResult(EMPTY_COUNTS);
    }

    const [
      world,
      characters,
      relationships,
      graphNodesCount,
      cultivationLevels,
      equipment,
      skills,
      factions,
      chapters,
    ] = await Promise.all([
      db.world_settings.where('bookId').equals(bookId).count(),
      db.characters.where('bookId').equals(bookId).count(),
      db.relationships.where('bookId').equals(bookId).count(),
      db.graph_nodes.where('bookId').equals(bookId).count(),
      db.cultivation_levels.where('bookId').equals(bookId).count(),
      db.equipment.where('bookId').equals(bookId).count(),
      db.skills.where('bookId').equals(bookId).count(),
      db.factions.where('bookId').equals(bookId).count(),
      db.chapters.where('bookId').equals(bookId).toArray(),
    ]);

    // 关系网里 moduleKey='region' 的节点数 = 地域数
    const regionCount = await db.graph_nodes
      .where('bookId')
      .equals(bookId)
      .filter((n) => n.moduleKey === 'region')
      .count();

    let chaptersFinal = 0;
    let chaptersOutline = 0;
    let totalWords = 0;
    for (const c of chapters) {
      if (c.status === 'final') chaptersFinal++;
      if (c.status === 'outline') chaptersOutline++;
      totalWords += wordCount(c.content);
    }

    const counts: BookCounts = {
      world,
      characters,
      relationships,
      regions: regionCount,
      locations: graphNodesCount, // 旧字段保留为「关系网节点总数」
      cultivationLevels,
      equipment,
      skills,
      factions,
      chapters: chapters.length,
      chaptersFinal,
      chaptersOutline,
      totalWords,
    };

    return buildResult(counts);
  }, [bookId]);
}

function buildResult(counts: BookCounts): GameProgressResult {
  // 各 Level 的当前数量（注意 L5 用 outline，L6 用 final）
  const cur: Record<number, number> = {
    1: counts.world,
    2: counts.characters,
    3: counts.cultivationLevels,
    4: counts.factions,
    5: counts.chaptersOutline + counts.chapters - counts.chaptersFinal, // 任意非 final 状态都算"已有大纲"
    6: counts.chaptersFinal,
  };

  let firstUnmet = -1;
  const levels: LevelProgress[] = LEVELS.map((cfg) => {
    const got = cur[cfg.level] ?? 0;
    const completed = got >= cfg.target;
    if (!completed && firstUnmet === -1) firstUnmet = cfg.level;
    return {
      level: cfg.level,
      name: cfg.name,
      description: cfg.description,
      target: cfg.target,
      current: got,
      completed,
      currentLevel: cfg.level === firstUnmet,
    };
  });

  const completedCount = levels.filter((l) => l.completed).length;
  return {
    levels,
    counts,
    completedCount,
    totalCount: LEVELS.length,
    percent: Math.round((completedCount / LEVELS.length) * 100),
  };
}

/**
 * Hook: 实时查询当前书籍的简化 Level 状态（仅 6 个 boolean + name）。
 * 保留向后兼容：用于 Home 卡片显示。
 */
export function useGameProgressSimple(bookId: number | null): GameProgress[] | undefined {
  const r = useGameProgress(bookId);
  if (!r) return undefined;
  return r.levels.map((l) => ({
    level: l.level,
    name: l.name,
    completed: l.completed,
    current: l.currentLevel,
  }));
}
