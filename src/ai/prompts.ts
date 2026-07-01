// =============================================================================
// ai-novel · Prompt 模板
// 严格对齐开发文档 9.3 节要求：
//   - system prompt：固定中文文案"你是一位优秀的小说写作助手..."
//   - user prompt 模板：世界观/人物/前文摘要/本章大纲 4 段拼接
//   - 提供多个可选风格模板（古风、网文、严肃文学），用户可切换
// =============================================================================

import type { NovelContext } from '@/db/types';
import { getRules, RULES_INTRO, CONTINUATION_CHAPTER_FULL_RULES } from './rules';

// =============================================================================
// 扩展类型 —— 在 db NovelContext 基础上增加 userPrompt 字段
// 注意：不要去改 db/types.ts（architect 的领域）。这里只是 ai 模块内部的视图类型。
// =============================================================================

/** ai 模块内部使用的扩展上下文（带 userPrompt） */
export interface AINovelContext extends NovelContext {
  /** 已经渲染好的 user prompt 字符串 */
  userPrompt: string;
  /** 上一章末尾 500 字原文（续章时注入） */
  prevChapterTail?: string;
  /** 关系网数据格式化字符串 */
  relations?: string;
  /** 阵营数据格式化字符串 */
  factions?: string;
}

// =============================================================================
// 风格模板
// =============================================================================

/** 写作风格 ID（持久化到 localStorage） */
export type WritingStyleId = 'classic' | 'webnovel' | 'literary';

/** 风格定义 */
export interface WritingStyle {
  id: WritingStyleId;
  label: string;
  description: string;
  /** 注入到 system prompt 末尾的风格指令 */
  systemDirective: string;
}

/** 内置三种风格 —— 严格对齐设计 token，文案保持中性 */
export const WRITING_STYLES: Record<WritingStyleId, WritingStyle> = {
  classic: {
    id: 'classic',
    label: '古风',
    description: '半文半白、章回体、意境留白，适合仙侠/历史/武侠题材。',
    systemDirective:
      '请使用半文半白的笔法，语句凝练而有留白，避免现代网络用语；' +
      '注重意境与人物神态，少用心理独白，多用动作与对话推进情节。',
  },
  webnovel: {
    id: 'webnovel',
    label: '网文',
    description: '节奏紧凑、爽点密集、对话驱动，适合玄幻/都市/系统流。',
    systemDirective:
      '请采用网文常见节奏：开篇抛钩子、每 500 字埋一个爽点或反转；' +
      '以对话与动作推进情节，少描写多冲突；段落短促，句式有力。',
  },
  literary: {
    id: 'literary',
    label: '严肃文学',
    description: '细腻心理描写、克制叙事、含蓄主题，适合现实/历史/心理题材。',
    systemDirective:
      '请采用严肃文学的笔法：注重人物内心与外部环境的微妙呼应；' +
      '语言克制，避免夸张的形容词；以细节暗示主题，结尾保持开放或留白。',
  },
};

export const DEFAULT_STYLE_ID: WritingStyleId = 'classic';

// =============================================================================
// localStorage 持久化（用户选择风格）
// =============================================================================

const STYLE_STORAGE_KEY = 'nc:writing_style';

export function getStoredStyle(): WritingStyleId {
  if (typeof localStorage === 'undefined') return DEFAULT_STYLE_ID;
  try {
    const v = localStorage.getItem(STYLE_STORAGE_KEY) as WritingStyleId | null;
    if (v && v in WRITING_STYLES) return v;
  } catch {
    /* noop */
  }
  return DEFAULT_STYLE_ID;
}

export function setStoredStyle(id: WritingStyleId): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STYLE_STORAGE_KEY, id);
  } catch {
    /* noop */
  }
}

const STYLE_HINT_STORAGE_KEY = 'nc:writing_style_hint';

export function getStoredStyleHint(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(STYLE_HINT_STORAGE_KEY) || '';
  } catch {
    /* noop */
  }
  return '';
}

export function setStoredStyleHint(hint: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STYLE_HINT_STORAGE_KEY, hint);
  } catch {
    /* noop */
  }
}

// =============================================================================
// System prompt 构造
// =============================================================================

/**
 * 构造 system prompt。
 * - 固定中文开场白（与开发文档 9.3 一字不差）
 * - 末尾追加风格指令
 * - 强调输出格式：HTML + 思源宋体 + 18px + 首行缩进 2em（与 TipTap 编辑器渲染保持一致）
 * - 追加章节生成连贯性规则
 */
export function buildSystemPrompt(
  style: WritingStyleId = DEFAULT_STYLE_ID,
  isFirstChapter: boolean = true,
): string {
  const styleInfo = WRITING_STYLES[style] ?? WRITING_STYLES[DEFAULT_STYLE_ID];
  return (
    '你是一位优秀的小说写作助手，擅长根据世界观、人物和情节大纲，' +
    '扩写出风格统一、节奏紧凑的章节正文。\n\n' +
    `【写作风格：${styleInfo.label}】\n${styleInfo.systemDirective}\n\n` +
    '【输出格式】\n' +
    '- 直接输出章节正文，不要写"好的/以下是/Chapter X"等多余套话。\n' +
    '- 使用 HTML 标签组织段落：<h1> 章节标题居中</h1>，<h2> 二级小节标题</h2>，<p> 段落</p>，' +
    '<blockquote> 对话或独白</blockquote>。\n' +
    '- 中文段落使用 <p> 包裹，自然分段；人物对话用 <blockquote> 或保留引号。\n' +
    '- 不要输出 markdown 语法（不要用 # / ** / >）。\n\n' +
    RULES_INTRO +
    getRules(isFirstChapter)
  );
}

// =============================================================================
// User prompt 构造
// =============================================================================

/**
 * 构造 user prompt —— 7 段拼接：
 *   世界观背景 → 相关人物 → 关系网 → 阵营 → 前文摘要 → 本章大纲 → 上一章末尾衔接（可选）
 * 与开发文档 9.3 节模板保持一致。
 */
export function buildUserPrompt(input: {
  worldSetting: string;
  characters: string;
  prevSummaries: string;
  outline: string;
  /** 续章时传入：前一章末尾 500 字原文（不传则表示首章） */
  prevChapterTail?: string;
  /** 关系网数据（格式化字符串） */
  relations?: string;
  /** 阵营数据（格式化字符串） */
  factions?: string;
}): string {
  const sections = [
    `【世界观背景】\n${input.worldSetting.trim() || '（暂无世界观设定）'}`,
    `【相关人物】\n${input.characters.trim() || '（暂无人物设定）'}`,
  ];

  // 关系网数据（有人物/势力之间的关联关系时才注入）
  if (input.relations) {
    sections.push(`【关系网】\n${input.relations}`);
  }

  // 阵营数据（正派/反派/中立等势力划分）
  if (input.factions) {
    sections.push(`【阵营划分】\n${input.factions}`);
  }

  sections.push(
    `【前文摘要】\n${input.prevSummaries.trim() || '（这是第一章，没有前情）'}`,
    `【本章大纲】\n${input.outline.trim() || '（请根据章节标题自由发挥，保持世界观一致）'}`,
  );

  // 续章时追加上一章末尾原文作为衔接参考
  if (input.prevChapterTail) {
    sections.push(
      `【上一章末尾衔接】\n以下是一章末尾的原文，请自然承接，不得复述或矛盾：\n${input.prevChapterTail}`,
    );
  }

  return sections.join('\n\n') + '\n\n请根据以上信息扩写为完整章节。';
}

// =============================================================================
// 一站式：根据 NovelContext 直接产出最终 systemPrompt / userPrompt
// =============================================================================

/**
 * 把构建好的 NovelContext 直接转换为可直接喂给 DeepSeek 的 prompt 字段。
 * 之所以暴露为独立函数，是为了未来做 prompt 模板 A/B / 单元测试留口子。
 */
export function renderPrompts(
  ctx: Omit<NovelContext, 'systemPrompt'> & { prevChapterTail?: string; relations?: string; factions?: string },
  style: WritingStyleId = DEFAULT_STYLE_ID,
  isFirstChapter: boolean = true,
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: buildSystemPrompt(style, isFirstChapter),
    userPrompt: buildUserPrompt({
      worldSetting: ctx.worldSetting,
      characters: ctx.characters,
      prevSummaries: ctx.prevSummaries,
      outline: ctx.outline,
      prevChapterTail: ctx.prevChapterTail,
      relations: ctx.relations,
      factions: ctx.factions,
    }),
  };
}

// =============================================================================
// 增量扩写 prompt —— 用于"基于已有正文再写一段"
// =============================================================================

/**
 * 用户在 TipTap 编辑器中选中一段文字后，让 AI 在不重写前文的前提下续写。
 * 区别于"全文扩写"，强调上下文边界。
 * 也注入连贯性规则（续章规则），确保增量扩写与全文生成风格一致。
 */
export function buildContinuationPrompt(input: {
  precedingText: string; // 选中位置之前的内容（截断后 ~1500 字）
  selectionText: string; // 用户选中的文字
  worldSetting: string;
  characters: string;
  /** 关系网数据（格式化字符串） */
  relations?: string;
  /** 阵营数据（格式化字符串） */
  factions?: string;
}): string {
  const sections = [
    `【世界观】\n${input.worldSetting || '（暂无）'}`,
    `【人物速览】\n${input.characters || '（暂无）'}`,
  ];

  if (input.relations) {
    sections.push(`【关系网】\n${input.relations}`);
  }
  if (input.factions) {
    sections.push(`【阵营划分】\n${input.factions}`);
  }

  sections.push(
    `【上文（截断）】\n${input.precedingText || '（这是开头）'}`,
    `【选中片段】\n${input.selectionText}`,
  );

  return (
    sections.join('\n\n') +
    '\n\n' +
    `【任务】请基于"选中片段"之后的位置继续扩写，保持人称、语气、节奏一致。` +
    `直接输出 HTML，不要复述上文。\n\n` +
    RULES_INTRO +
    CONTINUATION_CHAPTER_FULL_RULES
  );
}