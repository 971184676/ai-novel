// =============================================================================
// novel-creator · AI 上下文构建器
// 严格对齐开发文档 9.2 节要求：
//   - 输入：bookId + 当前章节号
//   - 输出 NovelContext { systemPrompt, worldSetting, characters,
//                          prevSummaries, outline, prevChapterTail }
//   - 人物格式："${name}: ${personality}"
//   - 前文摘要按 chapterNumber 升序拼接，超长截断
//   - 续章时追加前一章末尾 500 字原文作为衔接参考
// =============================================================================

import { db } from '@/db/database';
import type { Chapter, Character } from '@/db/types';
import {
  buildSystemPrompt,
  buildUserPrompt,
  getStoredStyle,
  type AINovelContext,
} from './prompts';

// =============================================================================
// 调优常量
// =============================================================================

/** 单条人物 description 截断长度（避免 prompt 过长） */
const MAX_PERSONALITY_CHARS = 200;

/** 前文摘要累计最大字符数（超出后按比例截断最早章节） */
const MAX_PREV_SUMMARY_CHARS = 1800;

/** 单条摘要的最大字符数 */
const MAX_SINGLE_SUMMARY_CHARS = 300;

/** 续章衔接：取前一章末尾原文的字符数 */
const PREV_CHAPTER_TAIL_CHARS = 500;

// =============================================================================
// 公开 API
// =============================================================================

export interface BuildContextOptions {
  /** 写作风格（不传则从 localStorage 读取，默认 'classic'） */
  style?: ReturnType<typeof getStoredStyle>;
  /** 当前章节 ID，用于排除自身（如果 outline 已存在） */
  chapterId?: number;
}

/**
 * 构建 DeepSeek 调用上下文。
 *
 * 数据流：
 *   1. 从 world_settings 表取该书的背景
 *   2. 从 characters 表取该书所有人物（按"主角 → 配角 → 反派 → NPC"排序）
 *   3. 从 chapters 表取 chapterNumber < 当前的所有 final/edited 章节的 summary
 *   4. 从 chapters 表取当前章节的 outline（用于 user prompt）
 *   5. 续章时：从上一章取末尾 500 字原文作为衔接参考
 *   6. 关系网和阵营数据也一并注入
 */
export async function buildContext(
  bookId: number,
  chapterNum: number,
  opts: BuildContextOptions = {},
): Promise<AINovelContext> {
  const style = opts.style ?? getStoredStyle();
  // 识别是否首章
  const isFirstChapter = chapterNum === 1;

  // 1) 世界观
  const world = await db.world_settings.where('bookId').equals(bookId).first();
  const worldSetting = composeWorldSetting(world);

  // 2) 人物
  const charactersAll = await db.characters
    .where('bookId')
    .equals(bookId)
    .toArray();
  const characters = composeCharacters(charactersAll, opts.chapterId);

  // 3) 前文摘要
  const prevChapters = await db.chapters
    .where('bookId')
    .equals(bookId)
    .filter((c) => c.chapterNumber < chapterNum && (c.status === 'final' || c.status === 'edited' || c.status === 'expanded'))
    .sortBy('chapterNumber');
  const prevSummaries = composePrevSummaries(prevChapters);

  // 4) 当前大纲
  const currentChapter = await db.chapters
    .where({ bookId, chapterNumber: chapterNum })
    .first();
  const outline = composeOutline(currentChapter);

  // 5) 续章时获取前一章末尾 500 字原文
  const prevChapterTail = isFirstChapter
    ? undefined
    : await getPrevChapterTail(bookId, chapterNum);

  // 6) 关系网数据
  const relations = await getRelations(bookId);

  // 7) 阵营数据
  const factions = await getFactions(bookId);

  const systemPrompt = buildSystemPrompt(style, isFirstChapter);
  const userPrompt = buildUserPrompt({
    worldSetting,
    characters,
    prevSummaries,
    outline,
    prevChapterTail,
    relations,
    factions,
  });

  return {
    systemPrompt,
    userPrompt,
    worldSetting,
    characters,
    prevSummaries,
    outline,
    prevChapterTail,
    relations,
    factions,
  } satisfies AINovelContext;
}

// =============================================================================
// 各部分拼接
// =============================================================================

/** 拼接世界观背景 */
function composeWorldSetting(world: { background?: string; coreRules?: string; name?: string } | undefined): string {
  if (!world) return '';
  const parts: string[] = [];
  if (world.name) parts.push(`《${world.name}》`);
  if (world.background) parts.push(world.background.trim());
  if (world.coreRules) parts.push(`核心规则：${world.coreRules.trim()}`);
  return parts.join('\n');
}

/**
 * 拼接人物段落。
 * - 排序：主角 → 配角 → 反派 → NPC
 * - 格式："姓名（分类）: 性格"
 */
function composeCharacters(characters: Character[], _chapterId?: number): string {
  if (!characters.length) return '';

  const order: Record<Character['category'], number> = {
    protagonist: 0,
    supporting: 1,
    villain: 2,
    npc: 3,
  };
  const sorted = [...characters].sort(
    (a, b) => order[a.category] - order[b.category],
  );

  return sorted
    .map((c) => {
      const personality =
        c.personality.length > MAX_PERSONALITY_CHARS
          ? c.personality.slice(0, MAX_PERSONALITY_CHARS) + '…'
          : c.personality;
      return `${c.name}（${categoryLabel(c.category)}）：${personality}`;
    })
    .join('\n');
}

function categoryLabel(c: Character['category']): string {
  switch (c) {
    case 'protagonist':
      return '主角';
    case 'supporting':
      return '配角';
    case 'villain':
      return '反派';
    case 'npc':
      return 'NPC';
    default:
      return c;
  }
}

/**
 * 拼接前文摘要。
 * - 格式："第 N 章：<summary>"
 * - 总长度上限 MAX_PREV_SUMMARY_CHARS；超出时按比例丢弃最早的章节
 */
function composePrevSummaries(chapters: Chapter[]): string {
  if (!chapters.length) return '';

  const lines = chapters.map((c) => {
    const summary = (c.summary ?? '').trim();
    const trimmed =
      summary.length > MAX_SINGLE_SUMMARY_CHARS
        ? summary.slice(0, MAX_SINGLE_SUMMARY_CHARS) + '…'
        : summary;
    const title = (c.title ?? '').trim();
    const head = title ? `第 ${c.chapterNumber} 章《${title}》` : `第 ${c.chapterNumber} 章`;
    return `${head}：${trimmed || '（暂无摘要）'}`;
  });

  let joined = lines.join('\n');
  if (joined.length <= MAX_PREV_SUMMARY_CHARS) return joined;

  // 超出则从头截掉（保留最近 N 章）
  const trimmed: string[] = [];
  let len = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (len + line.length + 1 > MAX_PREV_SUMMARY_CHARS) break;
    trimmed.unshift(line);
    len += line.length + 1;
  }
  joined = trimmed.join('\n');
  if (trimmed.length < lines.length) {
    joined = `（已省略更早的 ${lines.length - trimmed.length} 章摘要）\n` + joined;
  }
  return joined;
}

/**
 * 获取前一章末尾 500 字原文（用于续章衔接）。
 * 只取已完成的章节（final/edited/expanded）的 content 字段末尾。
 */
async function getPrevChapterTail(bookId: number, chapterNum: number): Promise<string | undefined> {
  const prevChapter = await db.chapters
    .where('bookId')
    .equals(bookId)
    .filter(
      (c) =>
        c.chapterNumber === chapterNum - 1 &&
        (c.status === 'final' || c.status === 'edited' || c.status === 'expanded'),
    )
    .first();

  if (!prevChapter || !prevChapter.content) return undefined;

  const content = prevChapter.content.trim();
  if (content.length <= PREV_CHAPTER_TAIL_CHARS) return content;

  return content.slice(-PREV_CHAPTER_TAIL_CHARS);
}

/**
 * 格式化关系网数据，用于注入 prompt。
 * 返回格式：人物A — 关系 — 人物B
 */
async function getRelations(bookId: number): Promise<string> {
  const nodes = await db.graph_nodes
    .where('bookId')
    .equals(bookId)
    .toArray();

  const edges = await db.graph_edges
    .where('bookId')
    .equals(bookId)
    .toArray();

  if (!nodes.length) return '';

  // 构建节点名映射
  const nodeMap = new Map(nodes.map((n) => [n.id, n.name]));

  // 格式化边
  const relations = edges
    .filter((e) => nodeMap.has(e.sourceNodeId) && nodeMap.has(e.targetNodeId))
    .map((e) => {
      const source = nodeMap.get(e.sourceNodeId)!;
      const target = nodeMap.get(e.targetNodeId)!;
      const label = e.label || '有关联';
      return `${source} — ${label} — ${target}`;
    });

  return relations.length > 0 ? relations.join('\n') : '';
}

/**
 * 格式化阵营数据，用于注入 prompt。
 * 返回格式：阵营名（立场）：势力简介
 */
async function getFactions(bookId: number): Promise<string> {
  const factions = await db.factions.where('bookId').equals(bookId).toArray();

  if (!factions.length) return '';

  const alignmentMap: Record<string, string> = {
    righteous: '正派',
    evil: '反派',
    neutral: '中立',
  };

  return factions
    .map((f) => {
      const alignment = alignmentMap[f.alignment] || f.alignment;
      const stance = f.stance ? `，立场：${f.stance}` : '';
      return `${f.name}（${alignment}${stance}）：${f.structure || '（暂无简介）'}`;
    })
    .join('\n');
}

/**
 * 拼接本章大纲。
 * - 如果有 outline 直接使用
 * - 否则尝试用 eventDescription + 标题
 */
function composeOutline(chapter: Chapter | undefined): string {
  if (!chapter) return '';
  const parts: string[] = [];
  if (chapter.title) parts.push(`标题：${chapter.title}`);
  if (chapter.outline) parts.push(chapter.outline.trim());
  if (chapter.eventDescription) parts.push(`事件：${chapter.eventDescription.trim()}`);
  return parts.join('\n');
}

// =============================================================================
// 便利方法：给"新建章节"做最小上下文（不需要 outline）
// =============================================================================

/**
 * 不带 outline 的最小上下文，用于"先扩写再写大纲"等特殊场景。
 */
export async function buildEmptyOutlineContext(
  bookId: number,
  opts: BuildContextOptions = {},
): Promise<AINovelContext> {
  const style = opts.style ?? getStoredStyle();
  const world = await db.world_settings.where('bookId').equals(bookId).first();
  const charactersAll = await db.characters.where('bookId').equals(bookId).toArray();

  // 关系网与阵营数据（与 buildContext 保持一致）
  const relations = await getRelations(bookId);
  const factions = await getFactions(bookId);

  const systemPrompt = buildSystemPrompt(style, true);
  const userPrompt = buildUserPrompt({
    worldSetting: composeWorldSetting(world),
    characters: composeCharacters(charactersAll),
    prevSummaries: '',
    outline: '',
    relations,
    factions,
  });

  return {
    systemPrompt,
    userPrompt,
    worldSetting: composeWorldSetting(world),
    characters: composeCharacters(charactersAll),
    prevSummaries: '',
    outline: '',
    relations,
    factions,
  };
}