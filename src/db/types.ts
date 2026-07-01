// =============================================================================
// ai-novel · Dexie 数据库表 TypeScript 类型定义
// 严格对齐 开发文档 3.2 节
// =============================================================================

// ----- 通用 enum 字符串字面量类型 -----

/** 书籍状态 */
export type BookStatus = 'ongoing' | 'completed';

/** 人物分类 */
export type CharacterCategory = 'protagonist' | 'supporting' | 'villain' | 'npc';

/** 关系类型 */
export type RelationshipType =
  | 'parent'
  | 'child'
  | 'master'
  | 'disciple'
  | 'lover'
  | 'friend'
  | 'sibling'
  | 'enemy'
  | 'custom';

/** 装备类型 */
export type EquipmentType = 'artifact' | 'formation' | 'pill' | 'talisman' | 'other';

/** 技能类型 */
export type SkillType = 'technique' | 'martial_art' | 'skill';

/** 阵营立场 */
export type FactionAlignment = 'righteous' | 'evil' | 'neutral';

/** 章节状态 */
export type ChapterStatus = 'outline' | 'expanded' | 'edited' | 'final';

// ----- 11 张表的 interface 定义 -----

/** 书籍 */
export interface Book {
  id?: number;
  name: string;
  genre: string;
  /** 简介（首页卡片 / 总览页副标题） */
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  status: BookStatus;
}

/** 世界观设定 */
export interface WorldSetting {
  id?: number;
  bookId: number;
  name: string;
  background: string;
  coreRules: string;
  notes: string;
  updatedAt: Date;
}

/** 人物 */
export interface Character {
  id?: number;
  bookId: number;
  name: string;
  gender: string;
  height?: number;
  weight?: number;
  personality: string;
  appearance: string;
  category: CharacterCategory;
  factionId?: number;
  notes: string;
  avatarColor: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 人物关系（保留：人物库/详情页用，新版关系网使用 GraphEdge） */
export interface Relationship {
  id?: number;
  bookId: number;
  sourceCharacterId: number;
  targetCharacterId: number;
  type: RelationshipType;
  customType?: string;
  description: string;
  createdAt: Date;
}

/** 关系网：模块类型 key（人物 / 势力 / 地域 / 宗门 / 用户自定义） */
export type GraphModuleKey = 'character' | 'faction' | 'region' | 'sect' | string;

/** 关系网：模块类型配置（每本书的「自定义模块」存在这张表；内置 4 种 hardcode） */
export interface GraphModuleType {
  id?: number;
  bookId: number;
  /** 唯一 key：内置 hardcode ('character'/'faction'/'region'/'sect')，自定义用户命名 */
  key: string;
  /** 显示名 */
  label: string;
  /** 节点几何形状字符（●■▲◆ 等） */
  icon: string;
  /** 节点强调色（hex），用于边框/形状填充 */
  color: string;
  /** 是否用户自定义 */
  isCustom: boolean;
}

/** 关系网：画布 —— 一张画布 = 一个独立的关系网（可按主题分组，如"人物关系"/"势力关系"） */
export interface GraphCanvas {
  id?: number;
  bookId: number;
  /** 画布名，例如「人物关系」「势力关系」「门派关系」 */
  name: string;
  /** 画布说明/备注（可选） */
  description?: string;
  /** 画布主色（用于 tab 标识色），缺省黑 */
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 关系网：节点 —— 一个节点代表一个模块实例（人/势力/地域/宗门/自定义） */
export interface GraphNode {
  id?: number;
  bookId: number;
  /** 所属画布 ID（v4+；老数据为 undefined，进入页面时由迁移归到默认画布） */
  canvasId?: number;
  /** 模块 key，关联 GraphModuleType.key */
  moduleKey: GraphModuleKey;
  /** 节点显示名 */
  name: string;
  /** 节点描述/备注 */
  description: string;
  /**
   * 分类标签：正派 / 邪派 / 中立 / 主角 / 配角 / 关键 / 边缘 / 自定义等
   * 留空表示未分类
   */
  category: string;
  /** 画布坐标 */
  positionX: number;
  positionY: number;
  /**
   * 可选：关联已有数据源（人物库 / 阵营）。
   * 删除源时需要联动（暂时不强制，留作以后扩展）。
   */
  linkedSourceId?: number;
  linkedSourceType?: 'character' | 'faction';
  /** 节点形状（来自 GraphModuleType.icon，可被节点自身覆盖） */
  icon?: string;
  /** 节点颜色覆盖 */
  color?: string;
  /** 自定义扩展字段（JSON 字符串） */
  meta?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 关系网：边 —— 两个节点之间的连接 */
export interface GraphEdge {
  id?: number;
  bookId: number;
  /** 所属画布 ID（v4+；老数据为 undefined） */
  canvasId?: number;
  sourceNodeId: number;
  targetNodeId: number;
  /** 短标签：浮在连接线上方（可选，作为关系摘要） */
  label?: string;
  /** 详细备注：同样浮在上方（hover 或选中时展开，可选） */
  note?: string;
  /** 线型 */
  style: 'solid' | 'dashed' | 'dotted';
  createdAt: Date;
  updatedAt: Date;
}

/** 关系网：节点在画布上的位置覆盖（用户拖动后保存，跨会话保留） */
export interface GraphNodePosition {
  id?: number;
  bookId: number;
  nodeId: number;
  positionX: number;
  positionY: number;
}

/** 修行境界 */
export interface CultivationLevel {
  id?: number;
  bookId: number;
  name: string;
  level: number;
  description: string;
  abilities: string;
}

/** 装备 */
export interface Equipment {
  id?: number;
  bookId: number;
  name: string;
  type: EquipmentType;
  rank: string;
  description: string;
  effects: string;
}

/** 技能 */
export interface Skill {
  id?: number;
  bookId: number;
  name: string;
  type: SkillType;
  attribute: string;
  effects: string;
  rank: string;
  description: string;
}

/** 阵营 */
export interface Faction {
  id?: number;
  bookId: number;
  name: string;
  alignment: FactionAlignment;
  stance: string;
  founder: string;
  structure: string;
  coreMembers: string;
  activeRegionIds: number[];
  /** 上级势力（可选）：让势力可以组成层级，例如 青云宗 隶属 正道联盟 */
  parentFactionId?: number;
}

/** 章节 */
export interface Chapter {
  id?: number;
  bookId: number;
  title: string;
  chapterNumber: number;
  outline: string;
  content: string;
  summary: string;
  characterIds: number[];
  /** 关联关系网节点（人物 / 势力 / 地域 / 宗门 / 自定义） */
  graphNodeIds: number[];
  eventDescription: string;
  status: ChapterStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ----- 视图/聚合类型（用于 UI 展示，不存数据库） -----

/** 游戏化 Level 进度 */
export interface GameProgress {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  completed: boolean;
  current: boolean;
}

export interface LevelConfig {
  level: GameProgress['level'];
  name: string;
  description: string;
  target: number;
}

/** DeepSeek 调用上下文 */
export interface NovelContext {
  systemPrompt: string;
  worldSetting: string;
  characters: string;
  prevSummaries: string;
  notes?: string;
  outline: string;
}

/** Settings (localStorage) */
export interface AppSettings {
  deepseekApiKey: string;
  themeMode: 'light';
}
