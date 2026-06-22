// =============================================================================
// novel-creator · 关系网（统一图：人物 / 势力 / 地域 / 宗门 / 自定义）
//
// 设计要点：
//  - 一张图画所有模块：人物 / 势力 / 地域 / 宗门 / 用户自定义
//  - 任意两个节点可连线；边有「短标签」+「详细备注」
//  - 短标签：始终浮在连接线上方
//  - 详细备注：默认隐藏，点击边时展开浮窗（也浮在连接线上方）
//  - 模块类型内置 4 种 + 用户可自定义（存 graph_module_types）
//  - 旧版 character / faction / relationship 表数据自动迁移到 graph_*
//  - 节点用几何形状（●■◆▲）区分模块类型，颜色一律黑/灰阶
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { db } from '@/db/database';
import { syncGraphNodeToSource, deleteLinkedSourceFromGraph } from '@/db/syncGraph';
import type {
  GraphNode as GraphNodeType,
  GraphEdge as GraphEdgeType,
  GraphCanvas as GraphCanvasT,
  GraphModuleType as GraphModuleTypeT,
  GraphModuleKey,
} from '@/db/types';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import type { RFNode, RFEdge } from './types';
import { resolveModuleDef, categoryColor, computeVisibleNodeIds, ensureGraphMigrated } from './utils';
import { FIT_VIEW_OPTIONS, PRO_OPTIONS, DEFAULT_EDGE_OPTIONS, DELETE_KEY_CODES } from './constants';
import { ModuleNodeView } from './GraphNode';
import { RelationEdgeView, ARROW_DEFS } from './GraphEdge';
import { ModulePalette } from './ModulePalette';
import { Toolbar } from './GraphToolbar';
import { NodeInspector } from './NodeInspector';
import { EdgeEditor } from './EdgeEditor';
import { CanvasSwitcher } from './CanvasSwitcher';
import { TypeManagerDialog } from './TypeManagerDialog';
import { EmptyState } from './GraphEmptyState';

export function GraphInner() {
  const { bookId } = useParams<{ bookId: string }>();
  const bookIdNum = bookId ? Number(bookId) : undefined;
  const reactFlow = useReactFlow();

  // 实时数据
  const graphNodes = useLiveQuery(
    () =>
      bookIdNum
        ? db.graph_nodes.where('bookId').equals(bookIdNum).toArray()
        : db.graph_nodes.toArray(),
    [bookIdNum],
    [] as GraphNodeType[],
  );
  const graphEdges = useLiveQuery(
    () =>
      bookIdNum
        ? db.graph_edges.where('bookId').equals(bookIdNum).toArray()
        : db.graph_edges.toArray(),
    [bookIdNum],
    [] as GraphEdgeType[],
  );
  const customModuleTypes = useLiveQuery(
    () =>
      bookIdNum
        ? db.graph_module_types.where('bookId').equals(bookIdNum).toArray()
        : db.graph_module_types.toArray(),
    [bookIdNum],
    [] as GraphModuleTypeT[],
  );
  /** 画布列表（每个 book 可建多张） */
  const canvases = useLiveQuery(
    async () => {
      const list = bookIdNum
        ? await db.graph_canvases.where('bookId').equals(bookIdNum).toArray()
        : await db.graph_canvases.toArray();
      return list.sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
    },
    [bookIdNum],
    [] as GraphCanvasT[],
  );

  // 当前画布 ID（null 表示未选，等默认画布建好后会被赋值）
  const [currentCanvasId, setCurrentCanvasId] = useState<number | null>(null);

  // 画布迁移结束后：选中第一个画布作为 currentCanvasId（不覆盖用户已选）
  useEffect(() => {
    if (currentCanvasId != null) return;
    if (canvases.length === 0) return;
    const first = canvases[0];
    if (first?.id != null) setCurrentCanvasId(first.id);
  }, [canvases, currentCanvasId]);

  // 切换 book 时重置 currentCanvasId
  useEffect(() => {
    setCurrentCanvasId(null);
  }, [bookIdNum]);

  // 自动迁移
  useEffect(() => {
    if (bookIdNum != null) {
      ensureGraphMigrated(bookIdNum).catch((err) => {
        console.error('[graph] migration failed', err?.stack ?? err);
      });
    }
  }, [bookIdNum]);

  // 工具状态
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [typesOpen, setTypesOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  /** 删除节点确认弹窗状态 */
  const [deleteNodeConfirm, setDeleteNodeConfirm] = useState<{ open: boolean; nodeId: number | null }>({
    open: false,
    nodeId: null,
  });
  /** 删除边确认弹窗状态 */
  const [deleteEdgeConfirm, setDeleteEdgeConfirm] = useState<{ open: boolean; edgeId: number | null }>({
    open: false,
    edgeId: null,
  });
  /** 删除画布确认弹窗状态 */
  const [deleteCanvasConfirm, setDeleteCanvasConfirm] = useState<{ open: boolean; canvasId: number | null }>({
    open: false,
    canvasId: null,
  });
  /** 删除自定义模块类型确认弹窗状态 */
  const [deleteCustomTypeConfirm, setDeleteCustomTypeConfirm] = useState<{ open: boolean; typeId: number | null }>({
    open: false,
    typeId: null,
  });

  // React Flow 状态：完全受控，手动 applyNodeChanges / applyEdgeChanges，
  // 避免 useNodesState 与 setNodes 同时写状态导致的删除节点反馈环。
  const [nodes, setNodes] = useState<RFNode[]>([]);
  const [edges, setEdges] = useState<RFEdge[]>([]);

  // ---------- 由数据生成节点 / 边（DB → ReactFlow） ----------
  // 关键修复：useEffect 仅在「DB 实际数据变化」时重建 ReactFlow 状态；
  // 用浅比较指纹判断「数据是否真的变了」，避免 useLiveQuery 引用变化时反复重建。
  const customTypesRef = useRef(customModuleTypes);
  customTypesRef.current = customModuleTypes;

  // 跟踪上一次的指纹（id|positionX|positionY|name|category 连成串）
  const nodesFingerprintRef = useRef('');
  useEffect(() => {
    if (!graphNodes) return;
    const visibleIds = computeVisibleNodeIds(graphNodes, graphEdges, currentCanvasId);
    const filtered = graphNodes.filter((n) => visibleIds.has(n.id!));
    const fp = filtered
      .map((n) => `${n.id}:${n.positionX},${n.positionY}:${n.name}:${n.category || ''}:${n.moduleKey}:${n.canvasId ?? ''}`)
      .join('|');
    if (fp === nodesFingerprintRef.current) return;
    nodesFingerprintRef.current = fp;

    const rfNodes: RFNode[] = filtered.map((n) => {
      const def = resolveModuleDef(n.moduleKey, customTypesRef.current ?? []);
      return {
        id: String(n.id),
        type: 'module',
        position: { x: n.positionX, y: n.positionY },
        data: {
          nodeId: n.id!,
          moduleKey: n.moduleKey,
          label: n.name || def.label,
          iconChar: n.icon ?? def.iconChar,
          category: n.category || '',
          categoryColor: categoryColor(n.category || ''),
        },
      };
    });
    setNodes(rfNodes);
  }, [graphNodes, graphEdges, currentCanvasId, setNodes]);

  const edgesFingerprintRef = useRef('');
  useEffect(() => {
    if (!graphEdges || !graphNodes) return;
    const visibleNodeIds = computeVisibleNodeIds(graphNodes, graphEdges, currentCanvasId);
    const filtered = graphEdges.filter(
      (e) => visibleNodeIds.has(e.sourceNodeId) && visibleNodeIds.has(e.targetNodeId),
    );
    const fp = filtered
      .map((e) => `${e.id}:${e.sourceNodeId}->${e.targetNodeId}:${e.label ?? ''}:${e.style}:${e.canvasId ?? ''}`)
      .join('|');
    if (fp === edgesFingerprintRef.current) return;
    edgesFingerprintRef.current = fp;

    const rfEdges: RFEdge[] = filtered.map((e) => ({
      id: String(e.id),
      source: String(e.sourceNodeId),
      target: String(e.targetNodeId),
      type: 'relation',
      data: {
        edgeId: e.id!,
        label: e.label,
        note: e.note,
        style: e.style,
      },
    }));
    setEdges(rfEdges);
  }, [graphEdges, graphNodes, currentCanvasId, setEdges]);

  // ---------- 删除节点（内部无确认） ----------
  const deleteNodeAndEdges = useCallback(async (nodeId: number) => {
    const [outgoing, incoming] = await Promise.all([
      db.graph_edges.where('sourceNodeId').equals(nodeId).toArray(),
      db.graph_edges.where('targetNodeId').equals(nodeId).toArray(),
    ]);
    const relatedIds = Array.from(new Set([...outgoing, ...incoming].map((e) => e.id!)));
    await db.transaction('rw', [db.graph_nodes, db.graph_edges], async () => {
      await db.graph_edges.bulkDelete(relatedIds);
      await db.graph_nodes.delete(nodeId);
    });
  }, []);

  // ---------- 删除节点（带确认，供按钮使用） ----------
  const handleDeleteNode = useCallback(
    async (nodeId: number) => {
      setDeleteNodeConfirm({ open: true, nodeId });
    },
    [],
  );

  const executeDeleteNode = useCallback(async () => {
    const nodeId = deleteNodeConfirm.nodeId;
    if (nodeId == null) return;
    if (selectedNodeId === String(nodeId)) {
      setSelectedNodeId(null);
    }
    // 关联源只在节点**显式**有 linkedSourceId 时才同步删除。
    // 当前新建策略已不再自动建源，所以纯关系网节点直接删即可。
    const targetNode = await db.graph_nodes.get(nodeId);
    if (targetNode?.linkedSourceId != null) {
      await deleteLinkedSourceFromGraph(nodeId);
    }
    await deleteNodeAndEdges(nodeId);
    setDeleteNodeConfirm({ open: false, nodeId: null });
  }, [deleteNodeAndEdges, deleteNodeConfirm.nodeId, selectedNodeId]);

  // ---------- 节点 / 边 change（用户拖动 / 选中） ----------
  // 包一层：保留 ReactFlow 内部 state 行为，再加我们的 DB 持久化
  const lastSyncedPositionRef = useRef(new Map<number, { x: number; y: number }>());
  const onNodesChange = useCallback(
    (changes: NodeChange<RFNode>[]) => {
      setNodes((prev) => applyNodeChanges(changes, prev));
      for (const change of changes) {
        if (change.type === 'remove') {
          // ReactFlow 的 Delete/Backspace 触发 remove，同步到数据库（无需确认）
          const nodeId = Number(change.id);
          if (selectedNodeId === change.id) {
            setSelectedNodeId(null);
          }
          // 仅当节点显式关联了源表（linkedSourceId）时才级联删除，
          // 纯关系网节点（新建的势力/人物）只删节点本身。
          (async () => {
            try {
              const n = await db.graph_nodes.get(nodeId);
              if (n?.linkedSourceId != null) {
                await deleteLinkedSourceFromGraph(nodeId);
              }
              await deleteNodeAndEdges(nodeId);
            } catch (err) {
              console.error('[graph] failed to delete node', err);
            }
          })();
          continue;
        }
        if (change.type === 'position' && change.position && change.dragging === false) {
          const id = Number(change.id);
          const last = lastSyncedPositionRef.current.get(id);
          if (last && last.x === change.position.x && last.y === change.position.y) {
            continue;
          }
          lastSyncedPositionRef.current.set(id, { x: change.position.x, y: change.position.y });
          db.graph_nodes.update(id, {
            positionX: change.position.x,
            positionY: change.position.y,
            updatedAt: new Date(),
          }).catch((err) => console.error('[graph] position save failed', err));
        }
      }
    },
    [deleteNodeAndEdges, selectedNodeId],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<RFEdge>[]) => {
      setEdges((prev) => applyEdgeChanges(changes, prev));
      // 删除关系时同步数据库
      for (const change of changes) {
        if (change.type === 'remove') {
          const edgeId = Number(change.id);
          db.graph_edges.delete(edgeId).catch((err) =>
            console.error('[graph] failed to delete edge', err),
          );
        }
      }
    },
    [],
  );

  // ---------- 连接处理：拖出线 → 新建边 ----------
  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    if (params.source === params.target) return;
    if (!bookIdNum) return;

    const sourceId = Number(params.source);
    const targetId = Number(params.target);

    db.graph_edges
      .add({
        bookId: bookIdNum,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        canvasId: currentCanvasId ?? undefined,
        style: 'solid',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as GraphEdgeType)
      .then((id) => {
        setSelectedEdgeId(String(id));
        setEditingEdgeId(String(id));
      })
      .catch((err) => console.error('[graph] failed to add edge', err));
  }, [bookIdNum, currentCanvasId]);

  // ---------- 选中 ----------
  const onNodeClick = useCallback((_: React.MouseEvent, node: RFNode) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setEditingEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: RFEdge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setEditingEdgeId(edge.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setEditingEdgeId(null);
  }, []);

  // ---------- 添加新节点 ----------
  // 关键规则：关系网里所有节点（人物 / 势力 / 地域 / 宗门 / 自定义）都**只**
  // 写入 graph_nodes，**不**再自动往 db.characters / db.factions 同步。
  // 阵营界面会从 graph_nodes 读"无所属"的孤儿节点用于批量分配。
  // 只有「手动新建阵营」才会在 db.factions 落记录（保持阵营的权威性）。
  const handleAddNode = useCallback(
    async (moduleKey: GraphModuleKey) => {
      if (!bookIdNum) return;
      const pos = {
        x: 200 + Math.random() * 400,
        y: 150 + Math.random() * 300,
      };
      const def = resolveModuleDef(moduleKey, customModuleTypes ?? []);

      const id = (await db.graph_nodes.add({
        bookId: bookIdNum,
        canvasId: currentCanvasId ?? undefined,
        moduleKey,
        name: `新${def.label}`,
        description: '',
        category: '',
        positionX: pos.x,
        positionY: pos.y,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as GraphNodeType)) as number;
      setSelectedNodeId(String(id));
    },
    [bookIdNum, customModuleTypes, currentCanvasId],
  );

  // ---------- 边保存（label / note / style） ----------
  const handleSaveEdge = useCallback(
    async (edgeId: number, patch: Partial<GraphEdgeType>) => {
      await db.graph_edges.update(edgeId, {
        ...patch,
        updatedAt: new Date(),
      });
    },
    [],
  );

  // ---------- 删除边 ----------
  const handleDeleteEdge = useCallback(async (edgeId: number) => {
    setDeleteEdgeConfirm({ open: true, edgeId });
  }, []);

  const executeDeleteEdge = useCallback(async () => {
    const edgeId = deleteEdgeConfirm.edgeId;
    if (edgeId == null) return;
    await db.graph_edges.delete(edgeId);
    setSelectedEdgeId(null);
    setEditingEdgeId(null);
    setDeleteEdgeConfirm({ open: false, edgeId: null });
  }, [deleteEdgeConfirm.edgeId]);

  // ---------- 画布管理 ----------
  const handleAddCanvas = useCallback(
    async (name: string) => {
      if (!bookIdNum) return;
      const id = (await db.graph_canvases.add({
        bookId: bookIdNum,
        name: name.trim() || '未命名画布',
        color: '#000000',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as GraphCanvasT)) as number;
      setCurrentCanvasId(id);
      return id;
    },
    [bookIdNum],
  );

  const handleRenameCanvas = useCallback(
    async (canvasId: number, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      await db.graph_canvases.update(canvasId, { name: trimmed, updatedAt: new Date() });
    },
    [],
  );

  const handleDeleteCanvas = useCallback(
    async (canvasId: number) => {
      if (!bookIdNum) return;
      if (canvases.length <= 1) {
        if (typeof window !== 'undefined') {
          window.alert('至少保留一张画布，不能删除最后一张。');
        }
        return;
      }
      setDeleteCanvasConfirm({ open: true, canvasId });
    },
    [bookIdNum, canvases.length],
  );

  const executeDeleteCanvas = useCallback(async () => {
    const canvasId = deleteCanvasConfirm.canvasId;
    if (canvasId == null || !bookIdNum) return;
    await db.transaction(
      'rw',
      [db.graph_canvases, db.graph_nodes, db.graph_edges],
      async () => {
        const nodes = await db.graph_nodes
          .where('canvasId')
          .equals(canvasId)
          .toArray();
        const nodeIds = new Set(nodes.map((n) => n.id!));
        const edges = await db.graph_edges
          .where('canvasId')
          .equals(canvasId)
          .toArray();
        const edgeIds = edges.map((e) => e.id!);
        if (edgeIds.length > 0) await db.graph_edges.bulkDelete(edgeIds);
        for (const id of nodeIds) {
          await db.graph_nodes.delete(id);
        }
        await db.graph_canvases.delete(canvasId);
      },
    );
    if (currentCanvasId === canvasId) {
      const remaining = canvases.find((c: GraphCanvasT) => c.id !== canvasId);
      setCurrentCanvasId(remaining?.id ?? null);
    }
    setDeleteCanvasConfirm({ open: false, canvasId: null });
  }, [bookIdNum, canvases, currentCanvasId, deleteCanvasConfirm.canvasId]);

  // ---------- 添加自定义模块类型 ----------
  const handleAddCustomType = useCallback(
    async (cfg: { key: string; label: string; icon: string; color: string }) => {
      if (!bookIdNum) return;
      await db.graph_module_types.add({
        bookId: bookIdNum,
        ...cfg,
        isCustom: true,
      });
    },
    [bookIdNum],
  );

  const handleDeleteCustomType = useCallback(async (id: number) => {
    setDeleteCustomTypeConfirm({ open: true, typeId: id });
  }, []);

  const executeDeleteCustomType = useCallback(async () => {
    const typeId = deleteCustomTypeConfirm.typeId;
    if (typeId == null) return;
    await db.graph_module_types.delete(typeId);
    setDeleteCustomTypeConfirm({ open: false, typeId: null });
  }, [deleteCustomTypeConfirm.typeId]);

  // ---------- 选中对象 ----------
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );
  const selectedGraphNode = useMemo(
    () => graphNodes?.find((n) => n.id === selectedNode?.data.nodeId) ?? null,
    [graphNodes, selectedNode],
  );
  const selectedGraphEdge = useMemo(
    () =>
      graphEdges?.find((e) => e.id === selectedEdge?.data?.edgeId) ?? null,
    [graphEdges, selectedEdge],
  );

  // ReactFlow 节点/边类型表（必须在 early return 之前定义，遵守 Rules of Hooks）
  const nodeTypes = useMemo(() => ({ module: ModuleNodeView }), []);
  const edgeTypes = useMemo(() => ({ relation: RelationEdgeView }), []);

  // 检视器回调（稳定引用）
  const closeNodeInspector = useCallback(() => setSelectedNodeId(null), []);
  const closeEdgeEditor = useCallback(() => {
    setSelectedEdgeId(null);
    setEditingEdgeId(null);
  }, []);
  const closeTypeManager = useCallback(() => setTypesOpen(false), []);
  const saveNode = useCallback(
    async (patch: Partial<GraphNodeType>) => {
      if (!selectedGraphNode?.id) return;
      await db.graph_nodes.update(selectedGraphNode.id, {
        ...patch,
        updatedAt: new Date(),
      });
      // 双向同步：名字/描述/分类改动 → 推回源表（Character / Faction）
      if (
        patch.name !== undefined ||
        patch.description !== undefined ||
        patch.category !== undefined
      ) {
        await syncGraphNodeToSource(selectedGraphNode.id);
      }
    },
    [selectedGraphNode?.id],
  );
  const deleteNodeFromInspector = useCallback(() => {
    if (!selectedGraphNode?.id) return;
    handleDeleteNode(selectedGraphNode.id);
  }, [selectedGraphNode?.id, handleDeleteNode]);

  // 加载中（必须放在所有 hooks 之后）
  if (!graphNodes || !graphEdges || !customModuleTypes) {
    return (
      <div className="flex items-center justify-center h-full text-2 text-sm">加载中…</div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {ARROW_DEFS}

      {/* 顶部画布切换器 */}
      <CanvasSwitcher
        canvases={canvases}
        currentCanvasId={currentCanvasId}
        onSwitch={setCurrentCanvasId}
        onAdd={handleAddCanvas}
        onRename={handleRenameCanvas}
        onDelete={handleDeleteCanvas}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.2}
        maxZoom={2}
        proOptions={PRO_OPTIONS}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        nodesConnectable
        elementsSelectable
        deleteKeyCode={DELETE_KEY_CODES}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#000000" />
        <Controls
          showInteractive={false}
          className="!bg-bg !border !border-border !shadow-none [&_button]:!bg-bg [&_button]:!border-border [&_button]:!text-text [&_button:hover]:!bg-surface"
        />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(0,0,0,0.04)"
          nodeColor={(node) => {
            const data = (node.data ?? {}) as { moduleKey?: string };
            switch (data.moduleKey) {
              case 'character': return '#000000';
              case 'faction':   return '#FFFFFF';
              case 'region':    return '#A3A3A3';
              case 'sect':      return '#333333';
              default:          return '#000000';
            }
          }}
          nodeStrokeColor="#000000"
          nodeBorderRadius={0}
          style={{ background: '#FFFFFF', border: '1px solid #000' }}
        />
      </ReactFlow>

      {/* 左侧模块面板 */}
      <ModulePalette
        open={paletteOpen}
        setOpen={setPaletteOpen}
        customs={customModuleTypes}
        onAdd={handleAddNode}
        onAddCustom={() => setTypesOpen(true)}
      />

      {/* 工具栏 */}
      <Toolbar
        onZoomIn={() => reactFlow.zoomIn({ duration: 200 })}
        onZoomOut={() => reactFlow.zoomOut({ duration: 200 })}
        onFitView={() => reactFlow.fitView({ padding: 0.15, duration: 300 })}
      />

      {/* 节点检视器 */}
      {selectedNode && selectedGraphNode && (
        <NodeInspector
          node={selectedNode}
          graphNode={selectedGraphNode}
          customs={customModuleTypes}
          onClose={closeNodeInspector}
          onSave={saveNode}
          onDelete={deleteNodeFromInspector}
        />
      )}

      {/* 边检视器（浮动在边上方） */}
      {selectedEdge && selectedGraphEdge && (
        <EdgeEditor
          edge={selectedGraphEdge}
          sourceNode={graphNodes.find((n) => n.id === selectedGraphEdge.sourceNodeId)}
          targetNode={graphNodes.find((n) => n.id === selectedGraphEdge.targetNodeId)}
          customs={customModuleTypes}
          onSave={handleSaveEdge}
          onDelete={handleDeleteEdge}
          onClose={closeEdgeEditor}
        />
      )}

      {/* 自定义类型管理弹窗 */}
      {typesOpen && (
        <TypeManagerDialog
          customs={customModuleTypes}
          onAdd={handleAddCustomType}
          onDelete={handleDeleteCustomType}
          onClose={closeTypeManager}
        />
      )}

      {/* 删除节点确认弹窗 */}
      <ConfirmDialog
        open={deleteNodeConfirm.open}
        onOpenChange={(open) => setDeleteNodeConfirm((prev) => ({ ...prev, open }))}
        title="删除节点"
        description="删除该节点？相关连线也会被删除。"
        confirmText="删除"
        cancelText="取消"
        confirmVariant="destructive"
        onConfirm={executeDeleteNode}
      />

      {/* 删除边确认弹窗 */}
      <ConfirmDialog
        open={deleteEdgeConfirm.open}
        onOpenChange={(open) => setDeleteEdgeConfirm((prev) => ({ ...prev, open }))}
        title="删除连线"
        description="删除该连线？"
        confirmText="删除"
        cancelText="取消"
        confirmVariant="destructive"
        onConfirm={executeDeleteEdge}
      />

      {/* 删除画布确认弹窗 */}
      <ConfirmDialog
        open={deleteCanvasConfirm.open}
        onOpenChange={(open) => setDeleteCanvasConfirm((prev) => ({ ...prev, open }))}
        title="删除画布"
        description="删除该画布？画布上的所有节点和连线会一起删除，且不可撤销。"
        confirmText="删除"
        cancelText="取消"
        confirmVariant="destructive"
        onConfirm={executeDeleteCanvas}
      />

      {/* 删除自定义模块类型确认弹窗 */}
      <ConfirmDialog
        open={deleteCustomTypeConfirm.open}
        onOpenChange={(open) => setDeleteCustomTypeConfirm((prev) => ({ ...prev, open }))}
        title="删除模块类型"
        description="删除该模块类型？使用此类型的节点不会删除。"
        confirmText="删除"
        cancelText="取消"
        confirmVariant="destructive"
        onConfirm={executeDeleteCustomType}
      />

      {graphNodes.length === 0 && (
        <EmptyState onAddModule={() => setPaletteOpen(true)} />
      )}
    </div>
  );
}