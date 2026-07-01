// =============================================================================
// Factions page —— 阵营 CRUD
// UI 对齐 mockups/factions.html：立场用形状（方/菱/三角） + 阵营卡
// =============================================================================

import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Map as MapIcon, Download, Check, X, Users } from 'lucide-react';
import { z } from 'zod';
import { db } from '@/db/database';
import {
  syncFactionToGraph,
  deleteFactionGraphNode,
  batchAssignCharactersToFaction,
  batchAssignFactionsToParent,
  batchAssignOrphansToFaction,
} from '@/db/syncGraph';
import type { Character, Faction, FactionAlignment, GraphNode } from '@/db/types';
import { useBookIdParam } from '@/hooks/useBookIdParam';
import { useBookStore } from '@/store/useBookStore';
import { ResourcePage, EmptyState } from '@/components/common/ResourcePage';
import { ResourceFormDialog } from '@/components/common/ResourceFormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TextField, TextareaField, SelectField, CheckboxGroupField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatStrip } from '@/components/common/StatStrip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ALIGNMENT_LABELS: Record<FactionAlignment, string> = {
  righteous: '正道',
  evil: '邪道',
  neutral: '中立',
};
const ALIGNMENT_OPTIONS = (Object.keys(ALIGNMENT_LABELS) as FactionAlignment[]).map((v) => ({
  value: v,
  label: ALIGNMENT_LABELS[v],
}));

/** 立场几何形状：方=正道 / 菱=中立 / 三角=邪道 */
function AlignmentShape({ kind, size = 12 }: { kind: FactionAlignment; size?: number }) {
  if (kind === 'righteous') {
    return (
      <span
        className="inline-block bg-text"
        style={{ width: size, height: size }}
        aria-label={ALIGNMENT_LABELS[kind]}
      />
    );
  }
  if (kind === 'neutral') {
    return (
      <span
        className="inline-block bg-bg"
        style={{
          width: size,
          height: size,
          border: '1.5px solid #000000',
          transform: 'rotate(45deg)',
        }}
        aria-label={ALIGNMENT_LABELS[kind]}
      />
    );
  }
  return (
    <span
      className="inline-block"
      style={{
        width: 0,
        height: 0,
        background: 'transparent',
        borderLeft: `${size / 2}px solid transparent`,
        borderRight: `${size / 2}px solid transparent`,
        borderBottom: `${(size * 5) / 6}px solid #000000`,
      }}
      aria-label={ALIGNMENT_LABELS[kind]}
    />
  );
}

const factionFormSchema = z.object({
  name: z.string().min(1, '阵营名称不能为空').max(30, '不能超过 30 字'),
  alignment: z.enum(['righteous', 'evil', 'neutral'] as const, {
    message: '请选择立场',
  }),
  stance: z.string().max(500, '立场描述不能超过 500 字'),
  founder: z.string().max(50, '创始人不能超过 50 字'),
  structure: z.string().max(1000, '组织结构不能超过 1000 字'),
  coreMembers: z.string().max(1000, '核心成员不能超过 1000 字'),
  activeRegionIds: z.array(z.union([z.string(), z.number()])),
  parentFactionId: z.union([z.string(), z.number()]).optional(),
});

type FactionFormValues = z.infer<typeof factionFormSchema>;

type FilterValue = 'all' | FactionAlignment | 'none';

export default function Factions() {
  const bookId = useBookIdParam();
  const setCurrentBookId = useBookStore((s) => s.setCurrentBookId);

  React.useEffect(() => {
    if (bookId != null) setCurrentBookId(bookId);
  }, [bookId, setCurrentBookId]);

  const [openCreate, setOpenCreate] = React.useState(false);
  const [editing, setEditing] = React.useState<Faction | undefined>(undefined);
  const [deleting, setDeleting] = React.useState<Faction | undefined>(undefined);

  // 底部统一分配区筛选 + 勾选
  const [itemFilter, setItemFilter] = React.useState<FilterValue>('all');
  const [itemSearch, setItemSearch] = React.useState('');
  const [selectedCharIds, setSelectedCharIds] = React.useState<Set<number>>(new Set());
  const [selectedFactionIds, setSelectedFactionIds] = React.useState<Set<number>>(new Set());
  /** 关系网孤儿节点选中：id = graph_node.id */
  const [selectedOrphanIds, setSelectedOrphanIds] = React.useState<Set<number>>(new Set());
  const [batchBusy, setBatchBusy] = React.useState(false);

  // ----- 跨 tab 同步：回到 Factions 标签页时强制刷新 -----
  // useLiveQuery 只在同一 tab 监听 db 变更，跨 tab 切回来时手动 invalidate
  const [visibilityTick, setVisibilityTick] = React.useState(0);
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setVisibilityTick((t) => t + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  // ----- 数据 -----
  const factions = useLiveQuery(
    () => (bookId == null ? [] : db.factions.where('bookId').equals(bookId).toArray()),
    [bookId, visibilityTick],
  ) ?? [];

  const characters = useLiveQuery(
    () => (bookId == null ? [] : db.characters.where('bookId').equals(bookId).toArray()),
    [bookId, visibilityTick],
  ) ?? [];

  /** 关系网中所有节点（含人物 / 势力 / 地域 / 宗门 / 自定义） */
  const graphNodes = useLiveQuery(
    () => (bookId == null ? [] : db.graph_nodes.where('bookId').equals(bookId).toArray()),
    [bookId, visibilityTick],
  ) ?? [];
  /** 兼容旧代码：FactionCard 活动区域下拉用此别名 */
  const regions = graphNodes;

  // ----- 一次性清理：删除旧版"关系网新建势力时自动落 db.factions"产生的孤儿 -----
  // 规则：删除 factions 记录的条件 = 名字仍是默认"新势力"且没被任何 character.factionId
  //       引用、且没有 graph_node 通过 linkedSourceId 关联（防止误删用户手动改过名的）。
  // 同时解除可能还挂在这些自动 faction 上的 graph_node.linkedSourceId 关联，
  //       让该 graph_node 变成"无阵营"分组中的孤儿。
  const cleanedOnceRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (bookId == null) return;
    if (cleanedOnceRef.current === bookId) return;
    cleanedOnceRef.current = bookId;
    (async () => {
      try {
        const allFactions = await db.factions.where('bookId').equals(bookId).toArray();
        const allCharacters = await db.characters.where('bookId').equals(bookId).toArray();
        const allNodes = await db.graph_nodes.where('bookId').equals(bookId).toArray();
        const referencedFactionIds = new Set<number>();
        for (const c of allCharacters) {
          if (c.factionId != null) referencedFactionIds.add(c.factionId);
        }
        const orphanAutoFactionIds: number[] = [];
        const linkedSourceIdsToClear: Array<{ nodeId: number; sourceId: number }> = [];
        for (const f of allFactions) {
          if (f.id == null) continue;
          // 仅清理"新势力" + stance 为空 + founder/structure/coreMembers 都为空 的"全默认"自动条目
          const isDefaultAuto =
            f.name === '新势力' &&
            (f.stance ?? '') === '' &&
            (f.founder ?? '') === '' &&
            (f.structure ?? '') === '' &&
            (f.coreMembers ?? '') === '';
          if (!isDefaultAuto) continue;
          // 不清理被 character 引用的
          if (referencedFactionIds.has(f.id)) continue;
          // 找出还挂在这个自动 faction 上的 graph_node（要清掉它们的 linkedSourceId）
          const linkedNodes = allNodes.filter(
            (n) => n.linkedSourceId === f.id && n.linkedSourceType === 'faction',
          );
          for (const n of linkedNodes) {
            if (n.id != null) linkedSourceIdsToClear.push({ nodeId: n.id, sourceId: f.id });
          }
          orphanAutoFactionIds.push(f.id);
        }
        if (orphanAutoFactionIds.length === 0) return;
        await db.transaction('rw', [db.factions, db.graph_nodes], async () => {
          for (const { nodeId, sourceId } of linkedSourceIdsToClear) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { linkedSourceId: _lsi, linkedSourceType: _lst, ...rest } =
              (await db.graph_nodes.get(nodeId)) ?? {};
            void _lsi;
            void _lst;
            await db.graph_nodes.update(nodeId, {
              ...rest,
              linkedSourceId: undefined,
              linkedSourceType: undefined,
              updatedAt: new Date(),
            });
          }
          await db.factions.bulkDelete(orphanAutoFactionIds);
        });
        console.info(
          `[factions] 已清理 ${orphanAutoFactionIds.length} 个自动生成的多余阵营条目（id: ${orphanAutoFactionIds.join(', ')}）`,
        );
      } catch (err) {
        console.error('[factions] cleanup auto factions failed', err);
      }
    })();
  }, [bookId, visibilityTick]);

  // ----- 派生统计 -----
  const factionCounts = React.useMemo(() => {
    const c: Record<FactionAlignment, number> = { righteous: 0, evil: 0, neutral: 0 };
    factions.forEach((f) => c[f.alignment]++);
    return c;
  }, [factions]);

  /** 关系网孤儿节点：moduleKey 是 character / faction 但**没有** linkedSourceId
   *  这些节点是关系网中自由创建的势力/人物，需要在"无阵营"分组里等待用户分配。 */
  const orphanGraphItems = React.useMemo(() => {
    return graphNodes
      .filter(
        (n) =>
          (n.moduleKey === 'character' || n.moduleKey === 'faction') &&
          n.linkedSourceId == null,
      )
      .map((n) => ({
        // 稳定 id：graph_node.id（避免与 characters/factions id 冲突）
        id: n.id!,
        kind: n.moduleKey as 'character' | 'faction',
        name: n.name,
        meta: n.moduleKey === 'faction' ? '势力' : '人物',
      }));
  }, [graphNodes]);

  /** 统一列表（含 db.characters + db.factions + 关系网孤儿），
   *  用于阵营分配区。每个 item 都有"所属阵营"信息。 */
  const itemToAssigned = React.useMemo(() => {
    const factionById = new Map(factions.map((f) => [f.id!, f]));
    const result: Array<
      | { kind: 'character'; id: number; data: Character; faction: Faction | undefined }
      | { kind: 'faction'; id: number; data: Faction; parent: Faction | undefined }
      | { kind: 'orphan'; id: number; orphanName: string; orphanModuleKey: 'character' | 'faction' }
    > = [];
    for (const c of characters) {
      if (c.id == null) continue;
      result.push({
        kind: 'character',
        id: c.id,
        data: c,
        faction: c.factionId != null ? factionById.get(c.factionId) : undefined,
      });
    }
    for (const f of factions) {
      if (f.id == null) continue;
      result.push({
        kind: 'faction',
        id: f.id,
        data: f,
        parent: f.parentFactionId != null ? factionById.get(f.parentFactionId) : undefined,
      });
    }
    for (const o of orphanGraphItems) {
      result.push({
        kind: 'orphan',
        id: o.id,
        orphanName: o.name,
        orphanModuleKey: o.kind,
      });
    }
    return result;
  }, [characters, factions, orphanGraphItems]);

  const unassignedCount = React.useMemo(
    () => itemToAssigned.filter((it) => {
      if (it.kind === 'orphan') return true; // 关系网孤儿一定无所属
      // 已建阵营（db.factions 中的顶级阵营）不计入"无所属"
      // 这里的"无所属"只指人物没绑阵营
      if (it.kind === 'faction') return false;
      return it.faction == null; // character：没绑阵营
    }).length,
    [itemToAssigned],
  );

  // ----- 统一筛选 -----
  const filteredItems = React.useMemo(() => {
    let list = itemToAssigned;
    if (itemFilter !== 'all') {
      if (itemFilter === 'none') {
        list = list.filter((it) => {
          if (it.kind === 'orphan') return true; // 关系网孤儿一定属于"无阵营"
          if (it.kind === 'faction') return false; // 已建阵营不属于"无阵营"
          return it.faction == null; // character：没绑阵营
        });
      } else {
        list = list.filter((it) => {
          if (it.kind === 'orphan') return false; // orphan 没有 alignment
          const align =
            it.kind === 'character'
              ? it.faction?.alignment
              : it.parent?.alignment ?? it.data.alignment;
          return align === itemFilter;
        });
      }
    }
    if (itemSearch.trim()) {
      const q = itemSearch.trim().toLowerCase();
      list = list.filter((it) => {
        if (it.kind === 'character') {
          return it.data.name.toLowerCase().includes(q) || it.data.notes.toLowerCase().includes(q);
        }
        if (it.kind === 'faction') {
          return it.data.name.toLowerCase().includes(q);
        }
        return it.orphanName.toLowerCase().includes(q);
      });
    }
    return list;
  }, [itemToAssigned, itemFilter, itemSearch]);

  // ----- CRUD handlers -----
  const onSubmit = async (values: FactionFormValues) => {
    if (bookId == null) return;
    const parentFactionId = values.parentFactionId
      ? Number(values.parentFactionId)
      : undefined;
    // 防呆：不能把自己设为自己的上级
    const safeParent = parentFactionId && parentFactionId === editing?.id ? undefined : parentFactionId;
    const payload: Omit<Faction, 'id'> & { id?: number } = {
      bookId,
      name: values.name,
      alignment: values.alignment,
      stance: values.stance,
      founder: values.founder,
      structure: values.structure,
      coreMembers: values.coreMembers,
      activeRegionIds: values.activeRegionIds.map((v) => Number(v)).filter((n) => Number.isFinite(n)),
      parentFactionId: safeParent,
    };
    let savedId: number | undefined;
    if (editing?.id) {
      await db.factions.update(editing.id, payload);
      savedId = editing.id;
    } else {
      savedId = (await db.factions.add(payload as Faction)) as number;
    }
    if (savedId) {
      await syncFactionToGraph(savedId);
      // 同步 parent → graph（建/删 faction → parent 的隶属边）
      if (safeParent) {
        await batchAssignFactionsToParent([savedId], safeParent);
      }
    }
    setEditing(undefined);
  };

  const onConfirmDelete = async () => {
    if (deleting?.id) {
      await deleteFactionGraphNode(deleting.id);
      await db.factions.delete(deleting.id);
    }
    setDeleting(undefined);
  };

  // ----- 批量分配（同时支持人物 + 势力 + 关系网孤儿） -----
  const toggleChar = (id: number) => {
    setSelectedCharIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFaction = (id: number) => {
    setSelectedFactionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleOrphan = (id: number) => {
    setSelectedOrphanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedCharIds((prev) => {
      const next = new Set(prev);
      filteredItems.forEach((it) => {
        if (it.kind === 'character') next.add(it.id);
      });
      return next;
    });
    setSelectedFactionIds((prev) => {
      const next = new Set(prev);
      filteredItems.forEach((it) => {
        if (it.kind === 'faction') next.add(it.id);
      });
      return next;
    });
    setSelectedOrphanIds((prev) => {
      const next = new Set(prev);
      filteredItems.forEach((it) => {
        if (it.kind === 'orphan') next.add(it.id);
      });
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedCharIds(new Set());
    setSelectedFactionIds(new Set());
    setSelectedOrphanIds(new Set());
  };

  const totalSelectedCount = selectedCharIds.size + selectedFactionIds.size + selectedOrphanIds.size;

  const handleAssignTo = async (factionId: number | undefined) => {
    if (totalSelectedCount === 0) return;
    if (bookId == null) return;
    setBatchBusy(true);
    try {
      if (selectedCharIds.size > 0) {
        await batchAssignCharactersToFaction(Array.from(selectedCharIds), factionId);
      }
      if (selectedFactionIds.size > 0) {
        await batchAssignFactionsToParent(Array.from(selectedFactionIds), factionId);
      }
      if (selectedOrphanIds.size > 0) {
        await batchAssignOrphansToFaction(Array.from(selectedOrphanIds), factionId, bookId);
      }
      clearSelection();
    } finally {
      setBatchBusy(false);
    }
  };

  // ----- 筛选 tab 数据 -----
  const itemFilterTabs: { value: FilterValue; label: React.ReactNode; count: number }[] = [
    { value: 'all', label: '全部', count: itemToAssigned.length },
    {
      value: 'righteous',
      label: (
        <span className="inline-flex items-center gap-1.5">
          <AlignmentShape kind="righteous" size={10} />
          正道
        </span>
      ),
      count: itemToAssigned.filter((it) => {
        if (it.kind === 'orphan') return false; // orphan 没有 alignment
        const a = it.kind === 'character' ? it.faction?.alignment : (it.parent?.alignment ?? it.data.alignment);
        return a === 'righteous';
      }).length,
    },
    {
      value: 'evil',
      label: (
        <span className="inline-flex items-center gap-1.5">
          <AlignmentShape kind="evil" size={10} />
          邪道
        </span>
      ),
      count: itemToAssigned.filter((it) => {
        if (it.kind === 'orphan') return false;
        const a = it.kind === 'character' ? it.faction?.alignment : (it.parent?.alignment ?? it.data.alignment);
        return a === 'evil';
      }).length,
    },
    {
      value: 'neutral',
      label: (
        <span className="inline-flex items-center gap-1.5">
          <AlignmentShape kind="neutral" size={10} />
          中立
        </span>
      ),
      count: itemToAssigned.filter((it) => {
        if (it.kind === 'orphan') return false;
        const a = it.kind === 'character' ? it.faction?.alignment : (it.parent?.alignment ?? it.data.alignment);
        return a === 'neutral';
      }).length,
    },
    {
      value: 'none',
      label: (
        <span className="inline-flex items-center gap-1.5">
          <X className="w-3 h-3" strokeWidth={1.5} />
          无阵营
        </span>
      ),
      count: unassignedCount,
    },
  ];

  if (bookId == null) {
    return <div className="text-sm text-2 p-8">未指定书籍 ID。</div>;
  }

  return (
    <>
      <ResourcePage
        eyebrow="LEVEL 4 · 体系完善"
        title="阵营"
        subtitle={
          factions.length === 0
            ? '先建阵营，再勾选人物 / 势力批量分配。建立至少 2 个阵营完成 Level 5。'
            : `共 ${factions.length} 个阵营 · ${unassignedCount} 项无所属`
        }
        primaryAction={{ label: '新建阵营', onClick: () => setOpenCreate(true) }}
        stats={[
          { label: '总阵营', value: factions.length },
          { label: '正道', value: factionCounts.righteous, marker: <AlignmentShape kind="righteous" size={10} /> },
          { label: '中立', value: factionCounts.neutral, marker: <AlignmentShape kind="neutral" size={10} /> },
          { label: '邪道', value: factionCounts.evil, marker: <AlignmentShape kind="evil" size={10} /> },
          { label: '无所属', value: unassignedCount },
        ]}
      >
        {/* ===== 顶部：已建阵营卡片 ===== */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-md font-semibold">已建阵营 · {factions.length}</h3>
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => setOpenCreate(true)}
            >
              <Plus className="w-3 h-3" strokeWidth={1.5} />
              新建阵营
            </Button>
          </div>

          {factions.length === 0 ? (
            <div className="bd border-dashed p-8 text-center">
              <Plus className="w-6 h-6 mx-auto mb-2 text-3" strokeWidth={1.5} />
              <div className="text-sm font-medium mb-1">还没有阵营</div>
              <div className="text-xs text-3 mb-3">先创建一个，然后勾选人物批量加入</div>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => setOpenCreate(true)}
              >
                <Plus className="w-3 h-3" strokeWidth={1.5} />
                新建第一个阵营
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {factions.map((f) => (
                <FactionCard
                  key={f.id ?? f.name}
                  faction={f}
                  regions={regions}
                  onClick={() => setEditing(f)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ===== 底部：人物批量分配 ===== */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-md font-semibold">分配成员 · 人物 / 势力</h3>
            <div className="flex items-center gap-2 text-xs">
              {selectedCharIds.size > 0 ? (
                <>
                  <span className="tnum text-2">已选 <span className="font-mono font-semibold text-text">{selectedCharIds.size}</span> 项</span>
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="text-text underline hover:no-underline"
                  >
                    全选可见 ({filteredItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-2 hover:text-text underline"
                  >
                    清空
                  </button>
                </>
              ) : (
                <span className="text-3">勾选多个人物后，可批量加入或移出阵营</span>
              )}
            </div>
          </div>

          {/* 筛选 tab + 搜索 */}
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <div className="flex gap-1 flex-wrap">
              {itemFilterTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setItemFilter(tab.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 border-2 text-xs tnum font-mono transition-all duration-150',
                    itemFilter === tab.value
                      // 选中：白底黑字 + 黑边 + 5px 黑阴影（更立体）
                      ? 'bg-bg text-text border-text shadow-[0_3px_0_0_#000] -translate-y-0.5'
                      // 未选中：白底黑字 + 浅灰边 + 3px 浅灰阴影
                      : 'bg-bg text-text border-border shadow-[0_2px_0_0_#E5E5E5] hover:bg-surface hover:border-text hover:shadow-[0_3px_0_0_#000]',
                  )}
                >
                  {tab.label}
                  <span className="opacity-70">{tab.count}</span>
                </button>
              ))}
            </div>
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="搜索人物 / 势力…"
              className="input-base flex-1 min-w-[160px] max-w-xs"
            />
          </div>

          {/* 统一列表（人物 + 势力） */}
          {itemToAssigned.length === 0 ? (
            <div className="bd p-8 text-center text-sm text-2">
              当前书籍还没有人物或势力。先去「人物库」建人物、或在上方「新建阵营」建势力，再来分配。
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bd p-8 text-center text-sm text-2">
              没有符合筛选条件的项
            </div>
          ) : (
            <div className="bd divide-y-2 divide-border">
              {filteredItems.map((it) =>
                it.kind === 'character' ? (
                  <AssignableRow
                    key={`c-${it.id}`}
                    kind="character"
                    name={it.data.name}
                    meta={it.data.gender || '—'}
                    assigned={it.faction}
                    selected={selectedCharIds.has(it.id)}
                    onToggle={() => toggleChar(it.id)}
                  />
                ) : it.kind === 'faction' ? (
                  <AssignableRow
                    key={`f-${it.id}`}
                    kind="faction"
                    name={it.data.name}
                    meta={it.data.alignment ? ALIGNMENT_LABELS[it.data.alignment] : '—'}
                    assigned={it.parent}
                    selected={selectedFactionIds.has(it.id)}
                    onToggle={() => toggleFaction(it.id)}
                  />
                ) : (
                  <AssignableRow
                    key={`o-${it.id}`}
                    kind={it.orphanModuleKey}
                    name={it.orphanName}
                    meta="关系网孤儿"
                    assigned={undefined}
                    selected={selectedOrphanIds.has(it.id)}
                    onToggle={() => toggleOrphan(it.id)}
                  />
                ),
              )}
            </div>
          )}
        </section>
      </ResourcePage>

      {/* 底部固定：批量操作条 */}
      {totalSelectedCount > 0 && (
        <div className="sticky bottom-4 mt-4 z-10">
          <div className="bd bg-bg shadow-[0_4px_0_0_#000] p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" strokeWidth={1.5} />
              已选 <span className="font-mono font-bold tnum">{totalSelectedCount}</span> 项
              {selectedCharIds.size > 0 && (
                <span className="text-2">（{selectedCharIds.size} 人物</span>
              )}
              {selectedFactionIds.size > 0 && (
                <span className="text-2">{selectedCharIds.size > 0 ? ' + ' : '（'}{selectedFactionIds.size} 势力</span>
              )}
              {selectedOrphanIds.size > 0 && (
                <span className="text-2">
                  {(selectedCharIds.size + selectedFactionIds.size) > 0 ? ' + ' : '（'}
                  {selectedOrphanIds.size} 关系网节点
                </span>
              )}
              {(() => {
                const total =
                  (selectedCharIds.size > 0 ? 1 : 0) +
                  (selectedFactionIds.size > 0 ? 1 : 0) +
                  (selectedOrphanIds.size > 0 ? 1 : 0);
                return total > 0 ? <span className="text-2">）</span> : null;
              })()}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="primary" disabled={batchBusy}>
                    <Check className="w-3 h-3" strokeWidth={1.5} />
                    分配到 ▾
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[220px]">
                  {factions.length === 0 ? (
                    <DropdownMenuItem disabled>请先新建阵营</DropdownMenuItem>
                  ) : (
                    factions
                      .filter((f) => !selectedFactionIds.has(f.id!)) // 不能把自己设为自己的上级
                      .map((f) => {
                        const memberCount = itemToAssigned.filter((it) => {
                          if (it.kind === 'character') return it.faction?.id === f.id;
                          if (it.kind === 'faction') return it.parent?.id === f.id;
                          return false;
                        }).length;
                        return (
                          <DropdownMenuItem
                            key={f.id}
                            onClick={() => handleAssignTo(f.id)}
                            className="flex items-center gap-2"
                          >
                            <AlignmentShape kind={f.alignment} size={10} />
                            <span className="flex-1 truncate">{f.name}</span>
                            <span className="text-xs text-3 tnum">{memberCount}</span>
                          </DropdownMenuItem>
                        );
                      })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAssignTo(undefined)}
                disabled={batchBusy}
              >
                <X className="w-3 h-3" strokeWidth={1.5} />
                从阵营移除
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                disabled={batchBusy}
              >
                清空选择
              </Button>
            </div>
          </div>
        </div>
      )}

      <FactionFormDialog
        open={openCreate}
        onOpenChange={(v) => {
          setOpenCreate(v);
          if (!v) setEditing(undefined);
        }}
        regions={regions}
        allFactions={factions}
        onSubmit={onSubmit}
      />
      <FactionFormDialog
        open={Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) setEditing(undefined);
        }}
        faction={editing}
        regions={regions}
        allFactions={factions}
        onSubmit={onSubmit}
        onDelete={
          editing
            ? async () => {
                if (editing.id) {
                  await deleteFactionGraphNode(editing.id);
                  await db.factions.delete(editing.id);
                }
                setDeleting(undefined);
                setEditing(undefined);
              }
            : undefined
        }
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => {
          if (!v) setDeleting(undefined);
        }}
        title="删除阵营"
        description={deleting ? `确定要删除「${deleting.name}」？相关人物的所属阵营也会清空。` : '确定要删除这个阵营？'}
        confirmText="删除"
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

// =============================================================================
// AssignableRow —— 统一行：人物 / 势力 都用这一个组件
// =============================================================================

function AssignableRow({
  kind,
  name,
  meta,
  assigned,
  selected,
  onToggle,
}: {
  kind: 'character' | 'faction';
  name: string;
  meta: string;
  assigned: Faction | undefined;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
        selected ? 'bg-surface' : 'hover:bg-surface',
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-4 h-4 accent-text cursor-pointer"
      />
      <span
        className={cn(
          'inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono tnum border border-text shrink-0 w-12 bg-bg text-text',
          kind === 'faction' && 'font-semibold',
        )}
      >
        {kind === 'character' ? '人物' : '势力'}
      </span>
      <span className="text-sm flex-1 truncate font-medium">{name}</span>
      <span className="text-xs text-3 tnum w-20 truncate">{meta}</span>
      {assigned && assigned.alignment ? (
        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 border-2 border-text bg-bg tnum shrink-0">
          <AlignmentShape kind={assigned.alignment} size={8} />
          {assigned.name}
        </span>
      ) : (
        <span className="text-xs text-3 tnum px-2 py-0.5 border border-dashed border-border shrink-0">
          无阵营
        </span>
      )}
    </label>
  );
}

// =============================================================================
// FactionCard —— 阵营卡（用纯黑 / 浅灰 / 白区分立场 banner）
// =============================================================================

function FactionCard({
  faction,
  regions,
  onClick,
}: {
  faction: Faction;
  regions: GraphNode[];
  onClick: () => void;
}) {
  const bannerClass =
    faction.alignment === 'righteous'
      ? 'bg-text text-bg'
      : faction.alignment === 'evil'
      ? 'bg-surface-2 text-text'
      : 'bg-bg text-text';

  const memberList = faction.coreMembers
    .split(/[\n,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="bd flex flex-col cursor-pointer hover:border-text transition-colors"
    >
      <header
        className={cn(
          'h-12 border-b border-text flex items-center px-5 gap-3',
          bannerClass,
        )}
      >
        <AlignmentShape kind={faction.alignment} size={12} />
        <span className="text-sm font-semibold tnum font-mono">
          {ALIGNMENT_LABELS[faction.alignment]}
        </span>
        <span className="ml-auto text-xs tnum font-mono opacity-70">
          F{String(faction.id ?? 0).padStart(3, '0')}
        </span>
      </header>
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-semibold mb-1 leading-tight">{faction.name}</h3>
          {faction.stance && (
            <p className="text-xs text-2 leading-relaxed line-clamp-3">
              {faction.stance}
            </p>
          )}
        </div>

        <div className="border-t border-border pt-3 space-y-1.5 text-xs">
          {faction.founder && (
            <Row label="创始人" value={faction.founder} />
          )}
          {faction.structure && (
            <Row label="组织" value={truncate(faction.structure, 30)} />
          )}
          {faction.activeRegionIds.length > 0 && (
            <Row
              label="活动区域"
              value={faction.activeRegionIds
                .map((id) => regions.find((r) => r.id === id)?.name ?? `#${id}`)
                .join('、')}
            />
          )}
        </div>

        {memberList.length > 0 && (
          <div className="border-t border-border pt-3 mt-auto">
            <div className="text-xs tnum text-3 mb-2 font-mono">
              核心成员 · {memberList.length}
            </div>
            <div className="space-y-1.5">
              {memberList.slice(0, 4).map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 bg-text" />
                  <span className="flex-1 truncate">{m}</span>
                </div>
              ))}
              {memberList.length > 4 && (
                <div className="text-xs text-3 tnum">+ {memberList.length - 4} 更多</div>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-3 tnum font-mono">{label}</span>
      <span className="truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// =============================================================================
// FactionFormDialog —— 阵营表单
// =============================================================================

function FactionFormDialog({
  open,
  onOpenChange,
  faction,
  regions,
  allFactions,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  faction?: Faction;
  regions: GraphNode[];
  allFactions: Faction[];
  onSubmit: (values: FactionFormValues) => Promise<void> | void;
  onDelete?: () => void;
}) {
  const defaultValues: FactionFormValues = {
    name: faction?.name ?? '',
    alignment: faction?.alignment ?? 'righteous',
    stance: faction?.stance ?? '',
    founder: faction?.founder ?? '',
    structure: faction?.structure ?? '',
    coreMembers: faction?.coreMembers ?? '',
    activeRegionIds: faction?.activeRegionIds?.map(String) ?? [],
    parentFactionId: faction?.parentFactionId != null ? String(faction.parentFactionId) : undefined,
  };

  const regionOptions = regions.map((r) => ({
    value: String(r.id ?? r.name),
    label: r.name,
  }));

  // 上级阵营候选（排除自己）
  const parentOptions = allFactions
    .filter((f) => f.id !== faction?.id)
    .map((f) => ({
      value: String(f.id),
      label: `${ALIGNMENT_LABELS[f.alignment]} · ${f.name}`,
    }));

  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={faction ? `编辑阵营 · ${faction.name}` : '新建阵营'}
      description={faction ? '修改阵营的属性' : '添加一个新的势力'}
      schema={factionFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitText={faction ? '保存' : '创建'}
      onDelete={onDelete}
      contentClassName="max-w-2xl"
    >
      {() => (
        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-7">
              <TextField name="name" label="阵营名称" required placeholder="例：青云宗" />
            </div>
            <div className="col-span-5">
              <SelectField
                name="alignment"
                label="立场"
                required
                options={ALIGNMENT_OPTIONS}
                placeholder="选择立场"
              />
            </div>
          </div>

          {parentOptions.length > 0 && (
            <SelectField
              name="parentFactionId"
              label="上级阵营（可选）"
              options={parentOptions}
              placeholder="无 — 作为顶级势力"
              hint="如果这是 青云宗 这种宗门，可以挂到 正道联盟 这种联盟下面"
            />
          )}

          <TextareaField
            name="stance"
            label="立场 / 概述"
            placeholder="阵营的宗旨、与外部的关系、行事风格…"
            rows={3}
          />

          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-6">
              <TextField name="founder" label="创始人" placeholder="例：青云真人" />
            </div>
            <div className="col-span-6">
              <TextField
                name="structure"
                label="组织结构"
                placeholder="例：掌门 / 长老 / 内门 / 外门"
              />
            </div>
          </div>

          {regionOptions.length > 0 && (
            <CheckboxGroupField
              name="activeRegionIds"
              options={regionOptions}
              label="活动区域"
              hint="选择该阵营活跃的地图区域（可多选）"
            />
          )}

          <TextareaField
            name="coreMembers"
            label="核心成员"
            placeholder="每行一个人物名，或用逗号分隔"
            rows={4}
          />
        </div>
      )}
    </ResourceFormDialog>
  );
}
