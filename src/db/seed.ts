// =============================================================================
// novel-creator · 数据初始化（首次启动时填充示例数据）
// 仅当数据库完全为空时执行；用户添加了真实数据后不再覆盖
// =============================================================================

import { db } from './database';
import type {
  Book,
  Character,
  Relationship,
  GraphNode,
  GraphEdge,
} from './types';

/**
 * 检查所有可视化相关表是否都为空
 */
async function isEmpty(): Promise<boolean> {
  const [characters, relationships, nodes, edges] = await Promise.all([
    db.characters.count(),
    db.relationships.count(),
    db.graph_nodes.count(),
    db.graph_edges.count(),
  ]);
  return characters === 0 && relationships === 0 && nodes === 0 && edges === 0;
}

/**
 * 创建示例书籍（如果没有）
 */
async function ensureSeedBook(): Promise<number> {
  const existing = await db.books.toArray();
  if (existing.length > 0) {
    const sorted = existing.slice().sort((a, b) => b.id! - a.id!);
    return sorted[0].id!;
  }
  const now = new Date();
  const id = await db.books.add({
    name: '九州仙途',
    genre: '仙侠',
    description: '【演示用例】这是一本示例书籍，展示平台的核心功能：人物设定、修行境界、关系网、阵营系统和章节创作。您可以直接浏览体验所有功能。',
    createdAt: now,
    updatedAt: now,
    status: 'ongoing',
  });
  return id as number;
}

const SEED_CHARACTERS: Array<Omit<Character, 'id' | 'bookId'>> = [
  {
    name: '林清羽',
    gender: '男',
    height: 178,
    weight: 68,
    personality: '坚韧、正义、偶有优柔',
    appearance: '青衫长剑，眉宇清朗',
    category: 'protagonist',
    factionId: undefined,
    notes: '青云宗内门弟子，本书主角。父母早亡，被白眉老祖收为关门弟子。',
    avatarColor: '#000000',
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-15T10:00:00Z'),
  },
  {
    name: '苏婉儿',
    gender: '女',
    height: 165,
    weight: 50,
    personality: '温婉、聪慧、外柔内刚',
    appearance: '白衣胜雪，容貌清丽',
    category: 'supporting',
    factionId: undefined,
    notes: '青云宗掌门之女，林清羽师妹。与叶青璇为结义姐妹，暗恋林清羽。',
    avatarColor: '#1F1F1F',
    createdAt: new Date('2026-01-15T10:05:00Z'),
    updatedAt: new Date('2026-01-15T10:05:00Z'),
  },
  {
    name: '叶青璇',
    gender: '女',
    height: 168,
    weight: 52,
    personality: '爽朗、洒脱、好打抱不平',
    appearance: '劲装束发，英气勃勃',
    category: 'supporting',
    factionId: undefined,
    notes: '散修，游历天下，与苏婉儿结义。与林清羽惺惺相惜。',
    avatarColor: '#3D3D3D',
    createdAt: new Date('2026-01-15T10:10:00Z'),
    updatedAt: new Date('2026-01-15T10:10:00Z'),
  },
  {
    name: '白眉老祖',
    gender: '男',
    height: 182,
    weight: 75,
    personality: '慈祥、深不可测、护短',
    appearance: '白眉长髯，仙风道骨',
    category: 'supporting',
    factionId: undefined,
    notes: '青云宗太上长老，元婴圆满，林清羽之师祖。',
    avatarColor: '#5A5A5A',
    createdAt: new Date('2026-01-15T10:15:00Z'),
    updatedAt: new Date('2026-01-15T10:15:00Z'),
  },
  {
    name: '血魔尊',
    gender: '男',
    height: 190,
    weight: 90,
    personality: '狠辣、阴鸷、心思缜密',
    appearance: '黑袍血目，气势逼人',
    category: 'villain',
    factionId: undefined,
    notes: '九幽魔域之主，化神期，与林清羽有杀父之仇。',
    avatarColor: '#000000',
    createdAt: new Date('2026-01-15T10:20:00Z'),
    updatedAt: new Date('2026-01-15T10:20:00Z'),
  },
  {
    name: '鬼面书生',
    gender: '男',
    height: 175,
    weight: 60,
    personality: '阴险、狡诈、善于伪装',
    appearance: '白面书生，手持折扇',
    category: 'villain',
    factionId: undefined,
    notes: '血魔尊麾下首席谋士，元婴期。',
    avatarColor: '#1F1F1F',
    createdAt: new Date('2026-01-15T10:25:00Z'),
    updatedAt: new Date('2026-01-15T10:25:00Z'),
  },
  {
    name: '酒馆老板',
    gender: '男',
    height: 170,
    weight: 80,
    personality: '热心、市井、八面玲珑',
    appearance: '微胖，满脸堆笑',
    category: 'npc',
    factionId: undefined,
    notes: '蓬莱镇老酒馆老板，凡人。江湖消息灵通。',
    avatarColor: '#3D3D3D',
    createdAt: new Date('2026-01-15T10:30:00Z'),
    updatedAt: new Date('2026-01-15T10:30:00Z'),
  },
  {
    name: '蓬莱镇镇长',
    gender: '男',
    height: 172,
    weight: 78,
    personality: '圆滑、明哲保身',
    appearance: '官服整洁',
    category: 'npc',
    factionId: undefined,
    notes: '蓬莱镇镇长，凡人官吏。',
    avatarColor: '#5A5A5A',
    createdAt: new Date('2026-01-15T10:35:00Z'),
    updatedAt: new Date('2026-01-15T10:35:00Z'),
  },
];

/**
 * 关系数据
 */
const RELATIONSHIP_DEFS: Array<{
  sourceName: string;
  targetName: string;
  type: Relationship['type'];
  customType?: string;
  description: string;
}> = [
  { sourceName: '苏婉儿', targetName: '林清羽', type: 'lover', description: '苏婉儿暗恋林清羽' },
  { sourceName: '白眉老祖', targetName: '林清羽', type: 'master', description: '白眉老祖是林清羽的师祖' },
  { sourceName: '林清羽', targetName: '苏婉儿', type: 'friend', description: '同门师兄妹' },
  { sourceName: '林清羽', targetName: '叶青璇', type: 'friend', description: '江湖知己' },
  { sourceName: '血魔尊', targetName: '林清羽', type: 'enemy', description: '杀父仇人' },
  { sourceName: '酒馆老板', targetName: '林清羽', type: 'friend', description: '小镇故人' },
  { sourceName: '苏婉儿', targetName: '叶青璇', type: 'sibling', description: '结义姐妹' },
  { sourceName: '血魔尊', targetName: '鬼面书生', type: 'master', description: '鬼面书生效忠于血魔尊' },
  { sourceName: '白眉老祖', targetName: '苏婉儿', type: 'master', description: '白眉老祖是苏婉儿的师父之一' },
];

/**
 * 关系网节点（地理 / 宗门）
 * 人物节点不在这里写：人物库仍走 characters 表，关系网自动从人物库 + 关系表迁移
 */
const SEED_GEO_NODES: Array<{ name: string; moduleKey: string; description: string; x: number; y: number; icon?: string; color?: string }> = [
  { name: '玄天大陆', moduleKey: 'region', description: '本书主舞台，三大宗派并立之地', x: 320, y: 240 },
  { name: '东海诸岛', moduleKey: 'region', description: '散修聚集之地', x: 700, y: 260 },
  { name: '九幽魔域', moduleKey: 'region', description: '血魔尊领地，禁地', x: 200, y: 500 },
  { name: '蓬莱仙岛', moduleKey: 'region', description: '海外仙山', x: 760, y: 120 },
  // 注：默认 sect 节点（青云宗/蜀山/血魔殿）已移除——v3 重构后由用户在阵营页自建
];

/**
 * 关系网边（跨类型连接：地理 ↔ 宗门、人 ↔ 宗门、人 ↔ 地理）
 * 这些会作为「示例边」写入 graph_edges 表
 */
const SEED_GRAPH_EDGES: Array<{
  fromName: string;
  fromKind: 'char' | 'node';
  toName: string;
  toKind: 'char' | 'node';
  label: string;
  note: string;
  style: 'solid' | 'dashed' | 'dotted';
}> = [
  // 注：默认 sect 边的种子数据已移除——v3 重构后由用户在阵营页通过批量分配创建
  // 保留少量跨地域关系作占位
  { fromName: '玄天大陆', fromKind: 'node', toName: '东海诸岛', toKind: 'node', label: '相邻', note: '东海与大陆隔海相望', style: 'dashed' },
  { fromName: '玄天大陆', fromKind: 'node', toName: '九幽魔域', toKind: 'node', label: '相邻', note: '魔域在大陆西北', style: 'dashed' },
  { fromName: '玄天大陆', fromKind: 'node', toName: '蓬莱仙岛', toKind: 'node', label: '相邻', note: '蓬莱在远海', style: 'dashed' },
];

/**
 * 初始化示例数据（首次启动时调用，幂等）
 */
export async function seedSampleData(): Promise<void> {
  if (!(await isEmpty())) return;

  const bookId = await ensureSeedBook();

  // 1. 写入人物
  const charIdMap = new Map<string, number>();
  await db.transaction('rw', db.characters, async () => {
    for (const ch of SEED_CHARACTERS) {
      const id = await db.characters.add({ ...ch, bookId });
      charIdMap.set(ch.name, id as number);
    }
  });

  // 2. 写入旧版关系表（保留兼容，新版关系网不依赖它）
  await db.transaction('rw', db.relationships, async () => {
    for (const r of RELATIONSHIP_DEFS) {
      const sourceId = charIdMap.get(r.sourceName);
      const targetId = charIdMap.get(r.targetName);
      if (!sourceId || !targetId) continue;
      await db.relationships.add({
        bookId,
        sourceCharacterId: sourceId,
        targetCharacterId: targetId,
        type: r.type,
        customType: r.customType,
        description: r.description,
        createdAt: new Date(),
      });
    }
  });

  // 3. 写入关系网：地理 / 宗门节点
  const nodeIdMap = new Map<string, number>();
  await db.transaction('rw', db.graph_nodes, async () => {
    for (const n of SEED_GEO_NODES) {
      const id = await db.graph_nodes.add({
        bookId,
        moduleKey: n.moduleKey,
        name: n.name,
        description: n.description,
        category: '',
        positionX: n.x,
        positionY: n.y,
        icon: n.icon,
        color: n.color,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as GraphNode);
      nodeIdMap.set(n.name, id as number);
    }
  });

  // 4. 写入关系网边（事务内同时建人物镜像节点 → 声明要带 graph_nodes，否则整事务回滚）
  await db.transaction('rw', [db.graph_nodes, db.graph_edges], async () => {
    for (const e of SEED_GRAPH_EDGES) {
      const sourceId =
        e.fromKind === 'char' ? charIdMap.get(e.fromName) : nodeIdMap.get(e.fromName);
      const targetId =
        e.toKind === 'char' ? charIdMap.get(e.toName) : nodeIdMap.get(e.toName);
      if (!sourceId || !targetId) continue;
      // 人 ↔ 人 / 人 ↔ 节点 的边统一写到 graph_edges
      // 但 graph_edges 只连 graph_nodes，所以人物也得先有 graph_node
      // 这里采用"自创建人物镜像节点"的方式：每个用到的人物确保有 graph_node
      let sourceNodeId = nodeIdMap.get(e.fromName);
      if (!sourceNodeId && e.fromKind === 'char') {
        const id = (await db.graph_nodes.add({
          bookId,
          moduleKey: 'character',
          name: e.fromName,
          description: '',
          category: '',
          positionX: 100 + Math.random() * 400,
          positionY: 100 + Math.random() * 400,
          linkedSourceId: sourceId,
          linkedSourceType: 'character',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as GraphNode)) as number;
        sourceNodeId = id;
        nodeIdMap.set(e.fromName, id);
      }
      let targetNodeId = nodeIdMap.get(e.toName);
      if (!targetNodeId && e.toKind === 'char') {
        const id = (await db.graph_nodes.add({
          bookId,
          moduleKey: 'character',
          name: e.toName,
          description: '',
          category: '',
          positionX: 100 + Math.random() * 400,
          positionY: 100 + Math.random() * 400,
          linkedSourceId: targetId,
          linkedSourceType: 'character',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as GraphNode)) as number;
        targetNodeId = id;
        nodeIdMap.set(e.toName, id);
      }
      if (!sourceNodeId || !targetNodeId) continue;
      await db.graph_edges.add({
        bookId,
        sourceNodeId,
        targetNodeId,
        label: e.label,
        note: e.note,
        style: e.style,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as GraphEdge);
    }
  });
}

/**
 * 清空所有可视化相关表（仅用于开发调试）
 */
export async function clearVisualizationData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.characters, db.relationships, db.graph_nodes, db.graph_edges, db.graph_module_types],
    async () => {
      await db.characters.clear();
      await db.relationships.clear();
      await db.graph_nodes.clear();
      await db.graph_edges.clear();
      await db.graph_module_types.clear();
    },
  );
}

// ---------------------------------------------------------------------------
// 自愈：补全因历史事务回滚丢失的跨类型示例边（人↔区域 / 人↔宗门）
// 触发条件：有区域/宗门节点，但缺少带"隶属/执掌/位于/对立"标签的边
// 幂等：检测到已有跨类型边就跳过
// ---------------------------------------------------------------------------

const CROSS_TYPE_EDGE_LABELS = new Set(['隶属', '执掌', '位于', '对立']);

const CROSS_TYPE_EDGE_DEFS: Array<{
  from: string;
  to: string;
  label: string;
  style: 'solid' | 'dashed';
  note: string;
}> = [
  // 注：默认 sect 边（青云宗/蜀山/血魔殿相关）已移除——
  // v3 重构后由用户在阵营页通过批量分配创建
];

export async function repairSeedCrossTypeEdges(): Promise<void> {
  // 找第一本书（演示用书）
  const book = await db.books.toCollection().first();
  if (!book?.id) return;
  const bookId = book.id;

  // 1) 必须有 region/sect 节点（来自原 seed），没有就说明不是这套数据
  const geoNodes = await db.graph_nodes
    .where('bookId')
    .equals(bookId)
    .filter((n) => n.moduleKey === 'region' || n.moduleKey === 'sect')
    .toArray();
  if (geoNodes.length === 0) return;

  // 2) 已存在任意跨类型边 → 跳过（避免重复）
  const allEdges = await db.graph_edges.where('bookId').equals(bookId).toArray();
  const hasCrossTypeEdge = allEdges.some(
    (e) => e.label != null && CROSS_TYPE_EDGE_LABELS.has(e.label),
  );
  if (hasCrossTypeEdge) return;

  // 3) 必须有默认画布
  const canvas = await db.graph_canvases.where('bookId').equals(bookId).first();
  if (!canvas?.id) return;

  // 4) 加载所有人物节点 + 地理/宗门节点
  const allNodes = await db.graph_nodes.where('bookId').equals(bookId).toArray();
  const charByName = new Map<string, number>();
  const geoByName = new Map<string, number>();
  for (const n of allNodes) {
    if (n.name && n.moduleKey === 'character') charByName.set(n.name, n.id!);
    if (n.name && (n.moduleKey === 'region' || n.moduleKey === 'sect')) {
      geoByName.set(n.name, n.id!);
    }
  }

  // 5) 缺的镜像人物节点就建一个（不再覆盖位置，避免和后续拖动冲突）
  const charSeedByName = new Map(SEED_CHARACTERS.map((c) => [c.name, c]));
  const now = new Date();

  await db.transaction('rw', [db.graph_nodes, db.graph_edges], async () => {
    for (const def of CROSS_TYPE_EDGE_DEFS) {
      // source
      let sourceId = charByName.get(def.from) ?? geoByName.get(def.from);
      if (sourceId == null) {
        const seed = charSeedByName.get(def.from);
        if (seed) {
          const newId = (await db.graph_nodes.add({
            bookId,
            canvasId: canvas.id,
            moduleKey: 'character',
            name: def.from,
            description: seed.notes ?? '',
            category:
              seed.category === 'protagonist'
                ? '主角'
                : seed.category === 'villain'
                  ? '邪派'
                  : seed.category === 'npc'
                    ? '边缘'
                    : '关键',
            positionX: 120 + Math.random() * 360,
            positionY: 120 + Math.random() * 360,
            linkedSourceId: undefined,
            linkedSourceType: 'character',
            createdAt: now,
            updatedAt: now,
          } as GraphNode)) as number;
          sourceId = newId;
          charByName.set(def.from, newId);
        }
      }
      // target
      let targetId = charByName.get(def.to) ?? geoByName.get(def.to);
      if (targetId == null) {
        const seed = charSeedByName.get(def.to);
        if (seed) {
          const newId = (await db.graph_nodes.add({
            bookId,
            canvasId: canvas.id,
            moduleKey: 'character',
            name: def.to,
            description: seed.notes ?? '',
            category:
              seed.category === 'protagonist'
                ? '主角'
                : seed.category === 'villain'
                  ? '邪派'
                  : seed.category === 'npc'
                    ? '边缘'
                    : '关键',
            positionX: 120 + Math.random() * 360,
            positionY: 120 + Math.random() * 360,
            linkedSourceId: undefined,
            linkedSourceType: 'character',
            createdAt: now,
            updatedAt: now,
          } as GraphNode)) as number;
          targetId = newId;
          charByName.set(def.to, newId);
        }
      }
      if (sourceId == null || targetId == null || sourceId === targetId) continue;
      await db.graph_edges.add({
        bookId,
        canvasId: canvas.id,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        label: def.label,
        note: def.note,
        style: def.style,
        createdAt: now,
        updatedAt: now,
      } as GraphEdge);
    }
  });
}

/**
 * v3 重构：清掉旧 seed 的默认 sect 节点 + 它们牵连的边。
 * 幂等：只删除名字恰好是默认样例（青云宗 / 蜀山剑派 / 血魔殿）的节点，
 * 用户自建的同名势力不会被误删（用户自建会在 factions 表里有 entry）。
 *
 * 同时清掉：
 *  - sect 节点之间、sect ↔ region 的「位于/对立/相邻」边
 *  - character graph_node 上的「隶属/执掌」边（指向默认 sect 的）
 *  - character.factionId 字段（之前 seed 没设，迁移后保持干净）
 */
export async function migrateRemoveDefaultSects(): Promise<void> {
  const DEFAULT_SECT_NAMES = new Set(['青云宗', '蜀山剑派', '血魔殿']);

  await db.transaction('rw', [db.graph_nodes, db.graph_edges], async () => {
    // 1. 找默认 sect 节点（排除已经在 factions 表里登记的 → 用户自建的）
    const allSects = await db.graph_nodes
      .filter((n) => n.moduleKey === 'sect')
      .toArray();
    const linkedFactionIds = new Set(
      allSects
        .filter((n) => n.linkedSourceType === 'faction' && n.linkedSourceId != null)
        .map((n) => n.linkedSourceId!),
    );
    const linkedFactions = linkedFactionIds.size > 0
      ? await db.factions.bulkGet(Array.from(linkedFactionIds))
      : [];
    const linkedFactionNames = new Set(
      linkedFactions.filter(Boolean).map((f: any) => f.name),
    );

    const defaultSects = allSects.filter(
      (n) => DEFAULT_SECT_NAMES.has(n.name) && !linkedFactionNames.has(n.name),
    );
    const sectIds = defaultSects.map((n) => n.id!).filter((x): x is number => x != null);

    if (sectIds.length === 0) return; // 没有需要清理的

    // 2. 找这些 sect 相关的边
    const allEdges = await db.graph_edges.toArray();
    const relatedEdgeIds = allEdges
      .filter((e) => sectIds.includes(e.sourceNodeId) || sectIds.includes(e.targetNodeId))
      .map((e) => e.id!)
      .filter((x): x is number => x != null);

    if (relatedEdgeIds.length > 0) {
      await db.graph_edges.bulkDelete(relatedEdgeIds);
    }

    // 3. 删 sect 节点本身
    await db.graph_nodes.bulkDelete(sectIds);
  });
}
