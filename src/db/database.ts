// =============================================================================
// ai-novel · Dexie 数据库定义
// 数据库名: NovelCreator
// 13 张表（v4 在 v3 基础上新增 graph_canvases 表，给 graph_nodes/edges 加 canvasId 索引）
// =============================================================================

import Dexie, { type Table } from 'dexie';
import type {
  Book,
  Character,
  Relationship,
  GraphNode,
  GraphEdge,
  GraphCanvas,
  GraphModuleType,
  CultivationLevel,
  Equipment,
  Skill,
  Faction,
  Chapter,
  WorldSetting,
} from './types';

export class NovelDB extends Dexie {
  // 13 张表
  books!: Table<Book, number>;
  world_settings!: Table<WorldSetting, number>;
  characters!: Table<Character, number>;
  relationships!: Table<Relationship, number>;
  graph_canvases!: Table<GraphCanvas, number>;
  graph_nodes!: Table<GraphNode, number>;
  graph_edges!: Table<GraphEdge, number>;
  graph_module_types!: Table<GraphModuleType, number>;
  cultivation_levels!: Table<CultivationLevel, number>;
  equipment!: Table<Equipment, number>;
  skills!: Table<Skill, number>;
  factions!: Table<Faction, number>;
  chapters!: Table<Chapter, number>;

  constructor() {
    super('NovelCreator');

    // Schema v1: 11 张表（原始版本，含 map_*）
    this.version(1).stores({
      books: '++id, name, status, createdAt, updatedAt',
      world_settings: '++id, bookId, updatedAt',
      characters: '++id, bookId, name, category, factionId',
      relationships: '++id, bookId, sourceCharacterId, targetCharacterId, type',
      map_regions: '++id, bookId, type',
      map_locations: '++id, bookId, regionId, type',
      cultivation_levels: '++id, bookId, level',
      equipment: '++id, bookId, type',
      skills: '++id, bookId, type',
      factions: '++id, bookId, alignment',
      chapters: '++id, bookId, chapterNumber, status, updatedAt',
    });

    // Schema v2: 加 map_terrain + map_marker_types
    this.version(2).stores({
      map_terrain: '++id, bookId, parentRegionId, type',
      map_marker_types: '++id, bookId, key, isCustom',
    });

    // Schema v3: 关系网重做
    //  - 移除所有 map_* 表（map_regions / map_locations / map_terrain / map_marker_types）
    //  - 新增 graph_nodes / graph_edges / graph_module_types
    this.version(3).stores({
      books: '++id, name, status, createdAt, updatedAt',
      world_settings: '++id, bookId, updatedAt',
      characters: '++id, bookId, name, category, factionId',
      relationships: '++id, bookId, sourceCharacterId, targetCharacterId, type',
      graph_nodes: '++id, bookId, moduleKey, linkedSourceId, linkedSourceType',
      graph_edges: '++id, bookId, sourceNodeId, targetNodeId',
      graph_module_types: '++id, bookId, key, isCustom',
      cultivation_levels: '++id, bookId, level',
      equipment: '++id, bookId, type',
      skills: '++id, bookId, type',
      factions: '++id, bookId, alignment',
      chapters: '++id, bookId, chapterNumber, status, updatedAt',
    });

    // Schema v4: 多画布
    //  - 新增 graph_canvases 表（一张画布 = 一个独立的关系网画布，可放不同主题的关系）
    //  - graph_nodes / graph_edges 加 canvasId 索引；旧数据 canvasId 为 null，
    //    首次进入页面时由 ensureGraphMigrated 归到 book 的默认画布
    this.version(4).stores({
      graph_canvases: '++id, bookId, name, createdAt',
      graph_nodes: '++id, bookId, canvasId, moduleKey, linkedSourceId, linkedSourceType',
      graph_edges: '++id, bookId, canvasId, sourceNodeId, targetNodeId',
    });
  }
}

export const db = new NovelDB();

/**
 * 一次性暴露 db 到 window 以便调试：
 *   在 DevTools 控制台执行 await db.books.toArray()
 */
if (typeof window !== 'undefined') {
  window.db = db;
}
