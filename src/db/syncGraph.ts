// =============================================================================
// novel-creator · 关系网 ↔ 人物库 / 阵营 双向同步
//
// 同步策略：
//   - 字段映射：
//       Character.name      ↔ GraphNode.name
//       Character.notes     ↔ GraphNode.description
//       Character.category  ↔ GraphNode.category（按表翻译）
//       Faction.name        ↔ GraphNode.name
//       Faction.stance      ↔ GraphNode.description
//       Faction.alignment   ↔ GraphNode.category（按表翻译）
//
//   - 防循环：每个同步函数先比对目标值是否已一致，一致就直接 return，
//     这样 A→B→A→B 的链式触发第二次就自动停下。
//
//   - 删除传播：删 Character/Faction → 删关联 graph_node（连带边）；
//     删 graph_node（如果关联了源）→ 删源 Character/Faction。
//
//   - 不在同步范围：Character 的 personality/appearance/avatarColor 等细字段
//     只在人物详情页维护；Faction 的 founder/structure/activeRegionIds 同理。
// =============================================================================

import { db } from './database';
import { hashPosition } from '@/components/graph/utils';
import type { Character, CharacterCategory, Faction, FactionAlignment, GraphEdge, GraphNode } from './types';

// -----------------------------------------------------------------------------
// Category 翻译表
// -----------------------------------------------------------------------------

const CHAR_CAT_TO_GRAPH: Record<CharacterCategory, string> = {
  protagonist: '主角',
  supporting: '关键',
  villain: '邪派',
  npc: '边缘',
};

const GRAPH_CAT_TO_CHAR: Record<string, CharacterCategory | undefined> = {
  主角: 'protagonist',
  关键: 'supporting',
  邪派: 'villain',
  边缘: 'npc',
};

const FACTION_ALIGN_TO_GRAPH: Record<FactionAlignment, string> = {
  righteous: '正派',
  evil: '邪派',
  neutral: '中立',
};

const GRAPH_CAT_TO_FACTION: Record<string, FactionAlignment | undefined> = {
  正派: 'righteous',
  邪派: 'evil',
  中立: 'neutral',
};

function charCategoryToGraph(c: Character): string {
  return CHAR_CAT_TO_GRAPH[c.category] ?? '未分类';
}

function graphCategoryToChar(g: string | undefined): CharacterCategory | undefined {
  if (!g) return undefined;
  return GRAPH_CAT_TO_CHAR[g];
}

function factionAlignmentToGraph(f: Faction): string {
  return FACTION_ALIGN_TO_GRAPH[f.alignment] ?? '未分类';
}

function graphCategoryToFaction(g: string | undefined): FactionAlignment | undefined {
  if (!g) return undefined;
  return GRAPH_CAT_TO_FACTION[g];
}

// 导出供 Factions 页"孤儿自愈"用
export { graphCategoryToFaction };

// -----------------------------------------------------------------------------
// 内部工具：查 / 创建默认 canvas
// -----------------------------------------------------------------------------

async function getDefaultCanvasId(bookId: number): Promise<number | undefined> {
  const canvas = await db.graph_canvases
    .where('bookId')
    .equals(bookId)
    .first();
  return canvas?.id;
}

async function findGraphNodeForCharacter(characterId: number): Promise<GraphNode | undefined> {
  return db.graph_nodes
    .where('linkedSourceId')
    .equals(characterId)
    .filter((n) => n.linkedSourceType === 'character')
    .first();
}

async function findGraphNodeForFaction(factionId: number): Promise<GraphNode | undefined> {
  return db.graph_nodes
    .where('linkedSourceId')
    .equals(factionId)
    .filter((n) => n.linkedSourceType === 'faction')
    .first();
}

// -----------------------------------------------------------------------------
// Push 方向：CRUD → 关系网
// -----------------------------------------------------------------------------

/** 把 Character 的 name/notes/category 推到对应的 graph_node（若不存在则新建）。 */
export async function syncCharacterToGraph(characterId: number): Promise<void> {
  const c = await db.characters.get(characterId);
  if (!c) return;

  const newName = c.name ?? '';
  const newDesc = c.notes ?? '';
  const newCat = charCategoryToGraph(c);

  const node = await findGraphNodeForCharacter(characterId);
  if (!node || node.id == null) {
    const canvasId = await getDefaultCanvasId(c.bookId);
    const pos = hashPosition(c.id ?? 0);
    await db.graph_nodes.add({
      bookId: c.bookId,
      canvasId,
      moduleKey: 'character',
      name: newName,
      description: newDesc,
      category: newCat,
      positionX: pos.x,
      positionY: pos.y,
      linkedSourceId: c.id,
      linkedSourceType: 'character',
      createdAt: c.createdAt ?? new Date(),
      updatedAt: new Date(),
    } as GraphNode);
    return;
  }

  // 已存在 → 比对字段，一致就跳过（防环关键）
  if (
    node.name === newName &&
    (node.description ?? '') === newDesc &&
    (node.category ?? '') === newCat
  ) {
    return;
  }

  await db.graph_nodes.update(node.id, {
    name: newName,
    description: newDesc,
    category: newCat,
    updatedAt: new Date(),
  });
}

/** 把 Faction 的 name/stance/alignment 推到对应的 graph_node。 */
export async function syncFactionToGraph(factionId: number): Promise<void> {
  const f = await db.factions.get(factionId);
  if (!f) return;

  const newName = f.name ?? '';
  const newDesc = f.stance ?? '';
  const newCat = factionAlignmentToGraph(f);

  const node = await findGraphNodeForFaction(factionId);
  if (!node || node.id == null) {
    const canvasId = await getDefaultCanvasId(f.bookId);
    const pos = hashPosition((f.id ?? 0) * 13);
    await db.graph_nodes.add({
      bookId: f.bookId,
      canvasId,
      moduleKey: 'faction',
      name: newName,
      description: newDesc,
      category: newCat,
      positionX: pos.x,
      positionY: pos.y,
      linkedSourceId: f.id,
      linkedSourceType: 'faction',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as GraphNode);
    return;
  }

  if (
    node.name === newName &&
    (node.description ?? '') === newDesc &&
    (node.category ?? '') === newCat
  ) {
    return;
  }

  await db.graph_nodes.update(node.id, {
    name: newName,
    description: newDesc,
    category: newCat,
    updatedAt: new Date(),
  });
}

/** 删 Character → 级联删除关联 graph_node（连同相关边） */
export async function deleteCharacterGraphNode(characterId: number): Promise<void> {
  const nodes = await db.graph_nodes
    .where('linkedSourceId')
    .equals(characterId)
    .filter((n) => n.linkedSourceType === 'character')
    .toArray();
  for (const n of nodes) {
    if (n.id == null) continue;
    await db.transaction('rw', [db.graph_nodes, db.graph_edges], async () => {
      const outgoing = await db.graph_edges.where('sourceNodeId').equals(n.id!).toArray();
      const incoming = await db.graph_edges.where('targetNodeId').equals(n.id!).toArray();
      const edgeIds = Array.from(new Set([...outgoing, ...incoming].map((e) => e.id!)));
      if (edgeIds.length > 0) await db.graph_edges.bulkDelete(edgeIds);
      await db.graph_nodes.delete(n.id!);
    });
  }
}

/** 删 Faction → 级联删除关联 graph_node（连同相关边） */
export async function deleteFactionGraphNode(factionId: number): Promise<void> {
  const nodes = await db.graph_nodes
    .where('linkedSourceId')
    .equals(factionId)
    .filter((n) => n.linkedSourceType === 'faction')
    .toArray();
  for (const n of nodes) {
    if (n.id == null) continue;
    await db.transaction('rw', [db.graph_nodes, db.graph_edges], async () => {
      const outgoing = await db.graph_edges.where('sourceNodeId').equals(n.id!).toArray();
      const incoming = await db.graph_edges.where('targetNodeId').equals(n.id!).toArray();
      const edgeIds = Array.from(new Set([...outgoing, ...incoming].map((e) => e.id!)));
      if (edgeIds.length > 0) await db.graph_edges.bulkDelete(edgeIds);
      await db.graph_nodes.delete(n.id!);
    });
  }
}

// -----------------------------------------------------------------------------
// Pull 方向：关系网 → CRUD
// -----------------------------------------------------------------------------

/** 把 graph_node 的 name/description/category 推回关联的 Character 或 Faction。 */
export async function syncGraphNodeToSource(nodeId: number): Promise<void> {
  const n = await db.graph_nodes.get(nodeId);
  if (!n) return;

  if (n.linkedSourceType === 'character' && n.linkedSourceId != null) {
    const c = await db.characters.get(n.linkedSourceId);
    if (!c) return;
    const newName = n.name ?? '';
    const newNotes = n.description ?? '';
    const newCat = graphCategoryToChar(n.category);
    if (
      c.name === newName &&
      (c.notes ?? '') === newNotes &&
      (newCat == null || c.category === newCat)
    ) {
      return;
    }
    await db.characters.update(c.id!, {
      name: newName,
      notes: newNotes,
      category: newCat ?? c.category,
      updatedAt: new Date(),
    });
    return;
  }

  if (n.linkedSourceType === 'faction' && n.linkedSourceId != null) {
    const f = await db.factions.get(n.linkedSourceId);
    if (!f) return;
    const newName = n.name ?? '';
    const newStance = n.description ?? '';
    const newAlign = graphCategoryToFaction(n.category);
    if (
      f.name === newName &&
      (f.stance ?? '') === newStance &&
      (newAlign == null || f.alignment === newAlign)
    ) {
      return;
    }
    await db.factions.update(f.id!, {
      name: newName,
      stance: newStance,
      alignment: newAlign ?? f.alignment,
    });
  }
}

// -----------------------------------------------------------------------------
// 阵营批量分配（Character.factionId ↔ 关系网"隶属"边）
// -----------------------------------------------------------------------------

/** 找到或创建 character 在默认 canvas 上的 graph_node。已存在则复用。 */
async function ensureCharacterGraphNode(characterId: number): Promise<number | null> {
  const c = await db.characters.get(characterId);
  if (!c) return null;
  const existing = await findGraphNodeForCharacter(characterId);
  if (existing?.id != null) return existing.id;
  // 不存在 → 先同步创建
  await syncCharacterToGraph(characterId);
  const created = await findGraphNodeForCharacter(characterId);
  return created?.id ?? null;
}

/** 找到或创建 faction 在默认 canvas 上的 graph_node。已存在则复用。 */
async function ensureFactionGraphNode(factionId: number): Promise<number | null> {
  const f = await db.factions.get(factionId);
  if (!f) return null;
  const existing = await findGraphNodeForFaction(factionId);
  if (existing?.id != null) return existing.id;
  await syncFactionToGraph(factionId);
  const created = await findGraphNodeForFaction(factionId);
  return created?.id ?? null;
}

/** 批量分配：把 character.factionId 设为指定 faction，
 *  并在关系网里建一条 character → faction 的「隶属」边（已存在则跳过）。
 *  factionId 为 undefined 时：清除 character.factionId + 删除相关边。 */
export async function batchAssignCharactersToFaction(
  characterIds: number[],
  factionId: number | undefined,
): Promise<void> {
  if (characterIds.length === 0) return;

  if (factionId == null) {
    // 清除阵营 → 删 character.factionId + 删 character graph_node 上所有到 faction 的边
    await db.transaction('rw', [db.characters, db.graph_edges], async () => {
      for (const cid of characterIds) {
        await db.characters.update(cid, { factionId: undefined, updatedAt: new Date() });
        const node = await findGraphNodeForCharacter(cid);
        if (!node?.id) continue;
        const edges = await db.graph_edges
          .where('sourceNodeId')
          .equals(node.id)
          .filter((e) => e.label === '隶属' || e.label === '执掌')
          .toArray();
        if (edges.length > 0) {
          await db.graph_edges.bulkDelete(edges.map((e) => e.id!));
        }
      }
    });
    return;
  }

  const f = await db.factions.get(factionId);
  if (!f) throw new Error(`阵营 #${factionId} 不存在`);

  const factionNodeId = await ensureFactionGraphNode(factionId);
  if (!factionNodeId) return;

  await db.transaction('rw', [db.characters, db.graph_nodes, db.graph_edges], async () => {
    for (const cid of characterIds) {
      await db.characters.update(cid, { factionId, updatedAt: new Date() });

      const charNodeId = await ensureCharacterGraphNode(cid);
      if (!charNodeId) continue;

      // 删掉这个 character 之前的所有「隶属/执掌」边（避免换阵营后留旧边）
      const oldEdges = await db.graph_edges
        .where('sourceNodeId')
        .equals(charNodeId)
        .filter((e) => e.label === '隶属' || e.label === '执掌')
        .toArray();
      if (oldEdges.length > 0) {
        await db.graph_edges.bulkDelete(oldEdges.map((e) => e.id!));
      }

      // 建新边：character → faction
      await db.graph_edges.add({
        bookId: f.bookId,
        canvasId: (await db.graph_canvases.where('bookId').equals(f.bookId).first())?.id,
        sourceNodeId: charNodeId,
        targetNodeId: factionNodeId,
        label: '隶属',
        note: `faction:${factionId}`,
        style: 'solid',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as GraphEdge);
    }
  });
}

/** 批量分配：把 faction.parentFactionId 设为指定上级阵营（让势力组成层级），
 *  并在关系网里建 faction → parent 的「隶属」边。 */
export async function batchAssignFactionsToParent(
  factionIds: number[],
  parentId: number | undefined,
): Promise<void> {
  if (factionIds.length === 0) return;

  // 防呆：不能把自己设为自己的上级（会成环）
  if (parentId != null && factionIds.includes(parentId)) {
    throw new Error('不能把势力设为自己的上级');
  }

  if (parentId == null) {
    // 清除上级
    await db.transaction('rw', [db.factions, db.graph_edges], async () => {
      for (const fid of factionIds) {
        await db.factions.update(fid, { parentFactionId: undefined });
        const node = await findGraphNodeForFaction(fid);
        if (!node?.id) continue;
        const edges = await db.graph_edges
          .where('sourceNodeId')
          .equals(node.id)
          .filter((e) => e.label === '隶属' || e.label === '执掌')
          .toArray();
        if (edges.length > 0) {
          await db.graph_edges.bulkDelete(edges.map((e) => e.id!));
        }
      }
    });
    return;
  }

  const parent = await db.factions.get(parentId);
  if (!parent) throw new Error(`上级势力 #${parentId} 不存在`);

  const parentNodeId = await ensureFactionGraphNode(parentId);
  if (!parentNodeId) return;

  await db.transaction('rw', [db.factions, db.graph_nodes, db.graph_edges], async () => {
    for (const fid of factionIds) {
      await db.factions.update(fid, { parentFactionId: parentId });

      const childNodeId = await ensureFactionGraphNode(fid);
      if (!childNodeId) continue;

      // 删旧的隶属/执掌边
      const oldEdges = await db.graph_edges
        .where('sourceNodeId')
        .equals(childNodeId)
        .filter((e) => e.label === '隶属' || e.label === '执掌')
        .toArray();
      if (oldEdges.length > 0) {
        await db.graph_edges.bulkDelete(oldEdges.map((e) => e.id!));
      }

      // 建新边
      await db.graph_edges.add({
        bookId: parent.bookId,
        canvasId: (await db.graph_canvases.where('bookId').equals(parent.bookId).first())?.id,
        sourceNodeId: childNodeId,
        targetNodeId: parentNodeId,
        label: '隶属',
        note: `parent:${parentId}`,
        style: 'solid',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as GraphEdge);
    }
  });
}

/** 删 graph_node → 级联删除关联的 Character 或 Faction。
 *  仅当该 graph_node 关联了源表时才触发。 */
export async function deleteLinkedSourceFromGraph(nodeId: number): Promise<void> {
  const n = await db.graph_nodes.get(nodeId);
  if (!n) return;
  if (n.linkedSourceType === 'character' && n.linkedSourceId != null) {
    await db.characters.delete(n.linkedSourceId);
  } else if (n.linkedSourceType === 'faction' && n.linkedSourceId != null) {
    await db.factions.delete(n.linkedSourceId);
  }
}

// -----------------------------------------------------------------------------
// 关系网孤儿节点 → 阵营批量分配
// -----------------------------------------------------------------------------

/** 把关系网中的孤儿节点（moduleKey='character'/'faction' 且没 linkedSourceId）
 *  分配到指定阵营。会在 db.characters / db.factions 落一份"实体"，并把
 *  graph_node 关联起来。
 *
 *  - character orphan + factionId：创建 Character(factionId) + 关联 graph_node
 *  - character orphan + undefined：创建 Character() （无所属）
 *  - faction orphan + factionId：创建 Faction(parentFactionId) + 关联 graph_node
 *  - faction orphan + undefined：创建 Faction() （无所属）
 *
 *  返回新建/更新的源表记录 id 列表。 */
export async function batchAssignOrphansToFaction(
  orphanNodeIds: number[],
  factionId: number | undefined,
  bookId: number,
): Promise<void> {
  if (orphanNodeIds.length === 0) return;

  // 校验目标阵营（如果有）
  let targetFaction: Faction | undefined;
  if (factionId != null) {
    targetFaction = await db.factions.get(factionId);
    if (!targetFaction) throw new Error(`阵营 #${factionId} 不存在`);
  }

  await db.transaction(
    'rw',
    [db.characters, db.factions, db.graph_nodes],
    async () => {
      for (const nodeId of orphanNodeIds) {
        const n = await db.graph_nodes.get(nodeId);
        if (!n) continue;
        // 已有 linkedSourceId 关联的节点 → 跳过（不该被当作 orphan）
        if (n.linkedSourceId != null) continue;

        if (n.moduleKey === 'character') {
          // 创建 Character（不写到 graph_nodes 的 characterId 关联，
          //   但建一条 graph_node → faction 的"隶属"边以便关系网可见）
          const newCharId = (await db.characters.add({
            bookId,
            name: n.name ?? '',
            notes: n.description ?? '',
            category: 'npc',
            factionId,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Character)) as number;
          await db.graph_nodes.update(nodeId, {
            linkedSourceId: newCharId,
            linkedSourceType: 'character',
            updatedAt: new Date(),
          });
          // 如果分配到了阵营，画一条"隶属"边到阵营的 graph_node
          if (factionId != null) {
            await addMembershipEdge(bookId, nodeId, factionId, n.name ?? '');
          }
        } else if (n.moduleKey === 'faction') {
          // 阵营 orphan → 创建 Faction，可作为目标阵营的下级
          const newFactionId = (await db.factions.add({
            bookId,
            name: n.name ?? '',
            alignment: targetFaction?.alignment ?? 'neutral',
            stance: n.description ?? '',
            founder: '',
            structure: '',
            coreMembers: '',
            activeRegionIds: [],
            parentFactionId: factionId,
          } as Faction)) as number;
          await db.graph_nodes.update(nodeId, {
            linkedSourceId: newFactionId,
            linkedSourceType: 'faction',
            updatedAt: new Date(),
          });
          // 如果分配到了上级阵营，建隶属边
          if (factionId != null) {
            await addMembershipEdge(bookId, nodeId, factionId, n.name ?? '');
          }
        }
        // 其他 moduleKey（region/sect/custom）不参与
      }
    },
  );
}

/** 内部：在 graph_node 和目标 faction 的 graph_node 之间建一条"隶属"边。
 *  自动确保双方的 graph_node 存在。 */
async function addMembershipEdge(
  bookId: number,
  fromNodeId: number,
  toFactionId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fromName: string,
): Promise<void> {
  // 找/建 target faction 的 graph_node
  let targetNode = await findGraphNodeForFaction(toFactionId);
  if (!targetNode?.id) {
    const f = await db.factions.get(toFactionId);
    if (!f) return;
    const canvasId = await getDefaultCanvasId(bookId);
    const pos = hashPosition((toFactionId ?? 0) * 13);
    const newNodeId = (await db.graph_nodes.add({
      bookId,
      canvasId,
      moduleKey: 'faction',
      name: f.name,
      description: f.stance ?? '',
      category: factionAlignmentToGraph(f),
      positionX: pos.x,
      positionY: pos.y,
      linkedSourceId: toFactionId,
      linkedSourceType: 'faction',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as GraphNode)) as number;
    targetNode = { id: newNodeId } as GraphNode;
  }
  // 已存在边就跳过
  const existing = await db.graph_edges
    .where('sourceNodeId')
    .equals(fromNodeId)
    .filter((e) => e.targetNodeId === targetNode!.id && e.label === '隶属')
    .first();
  if (existing) return;
  const canvasId = await getDefaultCanvasId(bookId);
  await db.graph_edges.add({
    bookId,
    canvasId,
    sourceNodeId: fromNodeId,
    targetNodeId: targetNode.id!,
    label: '隶属',
    note: `faction:${toFactionId}`,
    style: 'solid',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as GraphEdge);
}
