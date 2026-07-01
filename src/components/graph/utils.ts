import { db } from '@/db/database';
import type {
  GraphNode as GraphNodeType,
  GraphEdge as GraphEdgeType,
  GraphCanvas as GraphCanvasT,
  GraphModuleType as GraphModuleTypeT,
  Relationship,
} from '@/db/types';
import type { BuiltInKey } from './types';
import { BUILTIN_MODULES, CATEGORY_PRESETS } from './constants';

export function isBuiltInKey(k: string): k is BuiltInKey {
  return k === 'character' || k === 'faction' || k === 'region' || k === 'sect';
}

export function resolveModuleDef(
  key: string,
  customs: GraphModuleTypeT[],
): { key: string; label: string; iconChar: string } {
  if (isBuiltInKey(key)) {
    const b = BUILTIN_MODULES.find((m) => m.key === key)!;
    return { key, label: b.label, iconChar: b.iconChar };
  }
  const c = customs.find((m) => m.key === key);
  if (c) return { key, label: c.label, iconChar: c.icon };
  return { key, label: key, iconChar: '◇' };
}

export function hashPosition(seed: number): { x: number; y: number } {
  const x = 100 + (Math.abs((seed * 9301 + 49297) % 233280) % 700);
  const y = 80 + (Math.abs((seed * 7919 + 1009) % 233280) % 460);
  return { x, y };
}

export function categoryColor(cat: string): string {
  const preset = CATEGORY_PRESETS.find((p) => p.key === cat);
  if (preset) return preset.color;
  return cat ? '#000000' : '#A3A3A3';
}

export function relTypeLabel(t: Relationship['type']): string {
  const map: Record<Relationship['type'], string> = {
    parent: '父母',
    child: '子女',
    master: '师徒',
    disciple: '师徒',
    lover: '伴侣',
    friend: '朋友',
    sibling: '兄妹',
    enemy: '死敌',
    custom: '关联',
  };
  return map[t] ?? '关联';
}

export function relTypeToStyle(t: Relationship['type']): 'solid' | 'dashed' | 'dotted' {
  if (t === 'enemy') return 'dashed';
  if (t === 'custom') return 'dotted';
  return 'solid';
}

export function computeVisibleNodeIds(
  nodes: GraphNodeType[],
  edges: GraphEdgeType[] | undefined,
  canvasId: number | null,
): Set<number> {
  const matchingIds = new Set<number>();
  nodes.forEach((n) => {
    if (canvasId == null || n.canvasId == null || n.canvasId === canvasId) {
      matchingIds.add(n.id!);
    }
  });
  if (canvasId == null || !edges) return matchingIds;

  const visibleIds = new Set(matchingIds);
  edges.forEach((e) => {
    if (matchingIds.has(e.sourceNodeId) && e.canvasId === canvasId) visibleIds.add(e.targetNodeId);
    if (matchingIds.has(e.targetNodeId) && e.canvasId === canvasId) visibleIds.add(e.sourceNodeId);
  });
  return visibleIds;
}

const ensureGraphMigratedLocks = new Map<number, Promise<void>>();

export async function ensureGraphMigrated(bookId: number): Promise<void> {
  const locked = ensureGraphMigratedLocks.get(bookId);
  if (locked) return locked;

  const promise = (async () => {
    const defaultCanvas = await ensureDefaultCanvas(bookId);

    await db.transaction('rw', [db.graph_nodes, db.graph_edges], async () => {
      const orphanNodes = await db.graph_nodes
        .where('bookId')
        .equals(bookId)
        .filter((n) => n.canvasId == null)
        .toArray();
      for (const n of orphanNodes) {
        if (n.id != null) await db.graph_nodes.update(n.id, { canvasId: defaultCanvas, updatedAt: new Date() });
      }
      const orphanEdges = await db.graph_edges
        .where('bookId')
        .equals(bookId)
        .filter((e) => e.canvasId == null)
        .toArray();
      for (const e of orphanEdges) {
        if (e.id != null) await db.graph_edges.update(e.id, { canvasId: defaultCanvas, updatedAt: new Date() });
      }
    });

    const existingNodes = await db.graph_nodes.where('bookId').equals(bookId).toArray();
    const existingEdges = await db.graph_edges.where('bookId').equals(bookId).count();

    const chars = await db.characters.where('bookId').equals(bookId).toArray();
    const factions = await db.factions.where('bookId').equals(bookId).toArray();
    const oldRels = await db.relationships.where('bookId').equals(bookId).toArray();

    const now = new Date();

    if (chars.length === 0 && factions.length === 0 && oldRels.length === 0 && existingNodes.length === 0) {
      await seedSampleGraphData(bookId, defaultCanvas);
      return;
    }

    if (existingNodes.length > 0 && existingEdges > 0 && chars.length === 0 && factions.length === 0) return;

    const charIdToNodeId = new Map<number, number>();
    const factionIdToNodeId = new Map<number, number>();
    existingNodes.forEach((n) => {
      if (n.linkedSourceType === 'character' && n.linkedSourceId != null) {
        charIdToNodeId.set(n.linkedSourceId, n.id!);
      }
      if (n.linkedSourceType === 'faction' && n.linkedSourceId != null) {
        factionIdToNodeId.set(n.linkedSourceId, n.id!);
      }
    });

    await db.transaction('rw', [db.graph_nodes, db.graph_edges], async () => {
      for (const c of chars) {
        if (c.id != null && charIdToNodeId.has(c.id)) continue;
        const pos = hashPosition(c.id ?? 0);
        const id = (await db.graph_nodes.add({
          bookId,
          canvasId: defaultCanvas,
          moduleKey: 'character',
          name: c.name,
          description: c.notes ?? '',
          category: c.category === 'protagonist' ? '主角' : c.category === 'villain' ? '邪派' : c.category === 'npc' ? '边缘' : '关键',
          positionX: pos.x,
          positionY: pos.y,
          linkedSourceId: c.id,
          linkedSourceType: 'character',
          createdAt: c.createdAt ?? now,
          updatedAt: now,
        } as GraphNodeType)) as number;
        if (c.id != null) charIdToNodeId.set(c.id, id);
      }

      for (const f of factions) {
        if (f.id != null && factionIdToNodeId.has(f.id)) continue;
        const pos = hashPosition((f.id ?? 0) * 13);
        const id = (await db.graph_nodes.add({
          bookId,
          canvasId: defaultCanvas,
          moduleKey: 'faction',
          name: f.name,
          description: f.stance ?? '',
          category: f.alignment === 'righteous' ? '正派' : f.alignment === 'evil' ? '邪派' : '中立',
          positionX: pos.x,
          positionY: pos.y,
          linkedSourceId: f.id,
          linkedSourceType: 'faction',
          createdAt: now,
          updatedAt: now,
        } as GraphNodeType)) as number;
        if (f.id != null) factionIdToNodeId.set(f.id, id);
      }

      if (existingEdges === 0) {
        for (const r of oldRels) {
          const sourceId = charIdToNodeId.get(r.sourceCharacterId);
          const targetId = charIdToNodeId.get(r.targetCharacterId);
          if (!sourceId || !targetId || sourceId === targetId) continue;
          const label = r.customType ?? relTypeLabel(r.type);
          await db.graph_edges.add({
            bookId,
            canvasId: defaultCanvas,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            label,
            note: r.description ?? '',
            style: relTypeToStyle(r.type),
            createdAt: r.createdAt ?? now,
            updatedAt: now,
          } as GraphEdgeType);
        }
      }
    });
  })();

  ensureGraphMigratedLocks.set(bookId, promise);
  try {
    await promise;
  } finally {
    ensureGraphMigratedLocks.delete(bookId);
  }
}

const ensureDefaultCanvasLocks = new Map<number, Promise<number>>();

export async function ensureDefaultCanvas(bookId: number): Promise<number> {
  const locked = ensureDefaultCanvasLocks.get(bookId);
  if (locked) return locked;

  const promise = (async () => {
    const existing = await db.graph_canvases.where('bookId').equals(bookId).first();
    if (existing?.id != null) return existing.id;
    const id = (await db.graph_canvases.add({
      bookId,
      name: '人物关系',
      description: '默认画布。归类来自老版本的全部节点和边。',
      color: '#000000',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as GraphCanvasT)) as number;
    return id;
  })();

  ensureDefaultCanvasLocks.set(bookId, promise);
  try {
    return await promise;
  } finally {
    ensureDefaultCanvasLocks.delete(bookId);
  }
}

export async function seedSampleGraphData(bookId: number, canvasId: number): Promise<void> {
  const now = new Date();
  const nodeA: GraphNodeType = {
    bookId,
    canvasId,
    moduleKey: 'character',
    name: '示例人物甲',
    description: '示例人物节点',
    category: '主角',
    positionX: 200,
    positionY: 150,
    createdAt: now,
    updatedAt: now,
  };
  const nodeB: GraphNodeType = {
    bookId,
    canvasId,
    moduleKey: 'character',
    name: '示例人物乙',
    description: '示例人物节点',
    category: '关键',
    positionX: 500,
    positionY: 150,
    createdAt: now,
    updatedAt: now,
  };
  const nodeC: GraphNodeType = {
    bookId,
    canvasId,
    moduleKey: 'faction',
    name: '示例势力',
    description: '示例势力节点',
    category: '中立',
    positionX: 350,
    positionY: 350,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', [db.graph_nodes, db.graph_edges], async () => {
    const idA = await db.graph_nodes.add(nodeA);
    const idB = await db.graph_nodes.add(nodeB);
    const idC = await db.graph_nodes.add(nodeC);
    await db.graph_edges.add({
      bookId,
      canvasId,
      sourceNodeId: idA as number,
      targetNodeId: idB as number,
      label: '朋友',
      style: 'solid',
      createdAt: now,
      updatedAt: now,
    } as GraphEdgeType);
    await db.graph_edges.add({
      bookId,
      canvasId,
      sourceNodeId: idB as number,
      targetNodeId: idC as number,
      label: '关联',
      style: 'dotted',
      createdAt: now,
      updatedAt: now,
    } as GraphEdgeType);
    await db.graph_edges.add({
      bookId,
      canvasId,
      sourceNodeId: idC as number,
      targetNodeId: idA as number,
      label: '关联',
      style: 'dotted',
      createdAt: now,
      updatedAt: now,
    } as GraphEdgeType);
  });
}