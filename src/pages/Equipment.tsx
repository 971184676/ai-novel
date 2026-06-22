// =============================================================================
// Equipment page —— 装备 CRUD（type 筛选 + 列表）
// UI 对齐 mockups/equipment.html
// =============================================================================

import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Download, Upload, Sword, Shield, Hexagon, FlaskConical, Scroll } from 'lucide-react';
import { z } from 'zod';
import { db } from '@/db/database';
import type { Equipment, EquipmentType } from '@/db/types';
import { useBookIdParam } from '@/hooks/useBookIdParam';
import { useBookStore } from '@/store/useBookStore';
import { ResourcePage, EmptyState } from '@/components/common/ResourcePage';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { FilterTabs, FilterDivider } from '@/components/common/FilterTabs';
import { ResourceFormDialog } from '@/components/common/ResourceFormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TextField, TextareaField, SelectField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatStrip } from '@/components/common/StatStrip';
import { cn, wordCount } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  artifact: '法器',
  formation: '阵法',
  pill: '丹药',
  talisman: '符咒',
  other: '其他',
};
const EQUIPMENT_TYPE_OPTIONS = (Object.keys(EQUIPMENT_TYPE_LABELS) as EquipmentType[]).map(
  (v) => ({ value: v, label: EQUIPMENT_TYPE_LABELS[v] }),
);

const EQUIPMENT_TYPE_ICON: Record<EquipmentType, LucideIcon> = {
  artifact: Sword,
  formation: Hexagon,
  pill: FlaskConical,
  talisman: Scroll,
  other: Shield,
};

// 品级 → 线密度（用线段堆叠代替颜色）
const RANK_LEVELS = ['下品', '中品', '上品', '极品'] as const;
const RANK_OPTIONS = RANK_LEVELS.map((v) => ({ value: v, label: v }));
type Rank = (typeof RANK_LEVELS)[number];

function TierStrip({ rank }: { rank: string }) {
  const idx = RANK_LEVELS.indexOf(rank as Rank);
  const safeIdx = idx >= 0 ? idx : 1; // 默认中品
  const lines = safeIdx + 2; // 2..5
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          'font-mono tnum leading-none tracking-tight',
          safeIdx === 0 && 'text-3 text-xs',
          safeIdx === 1 && 'text-2 text-xs',
          safeIdx === 2 && 'text-text text-xs',
          safeIdx === 3 && 'text-text text-sm font-semibold',
        )}
      >
        {'━━ '.repeat(lines).trim()}
      </span>
      <span className="text-xs text-3 tnum font-mono mt-0.5">{rank}</span>
    </div>
  );
}

const equipmentFormSchema = z.object({
  name: z.string().min(1, '装备名称不能为空').max(30, '不能超过 30 字'),
  type: z.enum(['artifact', 'formation', 'pill', 'talisman', 'other'] as const, {
    message: '请选择装备类型',
  }),
  rank: z.string().min(1, '请选择品级'),
  description: z.string().min(1, '请填写描述').max(1000, '不能超过 1000 字'),
  effects: z.string().max(1000, '效果描述不能超过 1000 字'),
});

type EquipmentFormValues = z.infer<typeof equipmentFormSchema>;

type FilterValue = 'all' | EquipmentType;

export default function Equipment() {
  const bookId = useBookIdParam();
  const setCurrentBookId = useBookStore((s) => s.setCurrentBookId);

  React.useEffect(() => {
    if (bookId != null) setCurrentBookId(bookId);
  }, [bookId, setCurrentBookId]);

  const [filter, setFilter] = React.useState<FilterValue>('all');
  const [search, setSearch] = React.useState('');
  const [openCreate, setOpenCreate] = React.useState(false);
  const [editing, setEditing] = React.useState<Equipment | undefined>(undefined);
  const [deleting, setDeleting] = React.useState<Equipment | undefined>(undefined);

  const items = useLiveQuery(
    () => (bookId == null ? [] : db.equipment.where('bookId').equals(bookId).toArray()),
    [bookId],
  ) ?? [];

  // 关联人物（通过 factionId 不适用，装备持有者需要单独建模 —— 这里先用占位文字 "— 无"）
  // 因为 schema 没有 holderId 字段，holder 暂时留空

  const filtered = React.useMemo(() => {
    let list = items;
    if (filter !== 'all') list = list.filter((e) => e.type === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, filter, search]);

  const counts = React.useMemo(() => {
    const c: Record<EquipmentType, number> = {
      artifact: 0,
      formation: 0,
      pill: 0,
      talisman: 0,
      other: 0,
    };
    items.forEach((x) => c[x.type]++);
    return c;
  }, [items]);

  const onSubmit = async (values: EquipmentFormValues) => {
    if (bookId == null) return;
    const payload: Omit<Equipment, 'id'> & { id?: number } = {
      bookId,
      name: values.name,
      type: values.type,
      rank: values.rank,
      description: values.description,
      effects: values.effects,
    };
    if (editing?.id) {
      await db.equipment.update(editing.id, payload);
    } else {
      await db.equipment.add(payload as Equipment);
    }
    setEditing(undefined);
  };

  const onConfirmDelete = async () => {
    if (deleting?.id) {
      await db.equipment.delete(deleting.id);
    }
    setDeleting(undefined);
  };

  const columns: DataTableColumn<Equipment>[] = [
    {
      key: 'name',
      header: '装备名',
      width: '2.4fr',
      render: (e) => (
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{e.name}</div>
          <div className="text-xs text-3 truncate">
            {e.description.length > 40 ? e.description.slice(0, 40) + '…' : e.description}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: '类型',
      width: '0.7fr',
      render: (e) => <div className="text-sm">{EQUIPMENT_TYPE_LABELS[e.type]}</div>,
    },
    {
      key: 'rank',
      header: '品级',
      width: '1.1fr',
      render: (e) => <TierStrip rank={e.rank} />,
    },
    {
      key: 'effects',
      header: '效果',
      width: '2fr',
      render: (e) => (
        <div className="text-sm text-2 truncate">
          {e.effects || '— 无'}
        </div>
      ),
    },
  ];

  const filterItems = [
    { value: 'all' as FilterValue, label: '全部', count: items.length },
    ...EQUIPMENT_TYPE_OPTIONS.map((o) => ({
      value: o.value as FilterValue,
      label: o.label,
      count: counts[o.value as EquipmentType],
    })),
  ];

  if (bookId == null) {
    return <div className="text-sm text-2 p-8">未指定书籍 ID。</div>;
  }

  return (
    <>
      <ResourcePage
        eyebrow="LEVEL 3 · 世界观搭建 / 装备"
        title="装备"
        subtitle={
          items.length === 0
            ? '管理作品中的所有物品。建立第一件装备开始。'
            : `管理作品中的所有物品。共 ${items.length} 件装备，覆盖 ${Object.values(counts).filter((c) => c > 0).length} 个类型。`
        }
        primaryAction={{ label: '新建装备', onClick: () => setOpenCreate(true) }}
        secondaryActions={
          <>
            <Button type="button" size="sm" variant="ghost" title="导入">
              <Upload className="w-3 h-3" strokeWidth={1.5} />
              导入
            </Button>
            <Button type="button" size="sm" variant="ghost" title="导出">
              <Download className="w-3 h-3" strokeWidth={1.5} />
              导出
            </Button>
          </>
        }
        stats={[
          { label: '总装备', value: items.length },
          {
            label: '极品',
            value: (
              <span>
                {items.filter((e) => e.rank === '极品').length}
                <span className="text-xs text-3">/{items.length}</span>
              </span>
            ),
          },
          {
            label: '类型覆盖',
            value: Object.values(counts).filter((c) => c > 0).length,
          },
          { label: '效果描述字数', value: items.reduce((s, e) => s + wordCount(e.effects), 0) },
        ]}
        filters={{ items: filterItems, value: filter, onChange: setFilter }}
        search={{ value: search, onChange: setSearch, placeholder: '搜索装备名…' }}
        empty={items.length === 0}
        emptyState={
          <EmptyState
            title="还没有装备"
            hint="从添加第一件装备开始 —— 法器、阵法、丹药、符咒。"
            action={
              <Button type="button" size="sm" variant="primary" onClick={() => setOpenCreate(true)}>
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                新建装备
              </Button>
            }
          />
        }
      >
        {filtered.length === 0 ? (
          <div className="bd p-8 text-center text-sm text-2">
            {search || filter !== 'all' ? '没有符合筛选条件的装备。' : '还没有装备。'}
          </div>
        ) : (
          <>
            <DataTable
              items={filtered}
              columns={columns}
              rowKey={(e) => e.id ?? e.name}
              rowIcon={(e) => EQUIPMENT_TYPE_ICON[e.type]}
              onRowClick={(e) => setEditing(e)}
            />
            {/* 品级图例 */}
            <div className="flex items-center gap-6 mt-4 px-3 text-xs text-2 flex-wrap">
              <span>品级：</span>
              {RANK_LEVELS.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <TierStrip rank={r} />
                </div>
              ))}
            </div>
          </>
        )}
      </ResourcePage>

      <EquipmentFormDialog
        open={openCreate}
        onOpenChange={(v) => {
          setOpenCreate(v);
          if (!v) setEditing(undefined);
        }}
        onSubmit={onSubmit}
      />
      <EquipmentFormDialog
        open={Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) setEditing(undefined);
        }}
        equipment={editing}
        onSubmit={onSubmit}
        onDelete={
          editing
            ? async () => {
                if (editing.id) await db.equipment.delete(editing.id);
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
        title="删除装备"
        description={deleting ? `确定要删除「${deleting.name}」？` : '确定要删除这个装备？'}
        confirmText="删除"
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipment?: Equipment;
  onSubmit: (values: EquipmentFormValues) => Promise<void> | void;
  onDelete?: () => void;
}) {
  const defaultValues: EquipmentFormValues = {
    name: equipment?.name ?? '',
    type: equipment?.type ?? 'artifact',
    rank: equipment?.rank ?? '中品',
    description: equipment?.description ?? '',
    effects: equipment?.effects ?? '',
  };

  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={equipment ? `编辑装备 · ${equipment.name}` : '新建装备'}
      description={equipment ? '修改装备的属性，保存后立即生效' : '添加一件新的装备'}
      schema={equipmentFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitText={equipment ? '保存' : '创建'}
      onDelete={onDelete}
      contentClassName="max-w-2xl"
    >
      {() => (
        <div className="space-y-4">
          <TextField name="name" label="装备名称" required placeholder="例：青锋剑" />

          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-6">
              <SelectField
                name="type"
                label="装备类型"
                required
                options={EQUIPMENT_TYPE_OPTIONS}
                placeholder="选择类型"
              />
            </div>
            <div className="col-span-6">
              <SelectField
                name="rank"
                label="品级"
                required
                options={RANK_OPTIONS}
                placeholder="选择品级"
              />
            </div>
          </div>

          <TextareaField
            name="description"
            label="描述"
            placeholder="装备的外观、来源、背景故事…"
            rows={3}
            required
          />

          <TextareaField
            name="effects"
            label="效果"
            placeholder="装备附加的属性、特殊效果、被动技能…"
            rows={4}
          />
        </div>
      )}
    </ResourceFormDialog>
  );
}
