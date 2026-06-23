// =============================================================================
// Cultivation page —— 修行境界（CRUD + @dnd-kit 拖拽排序）
// UI 对齐 mockups/cultivation.html：堆叠卡片 + 拖拽手柄 + current 翻转强调
// =============================================================================

import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, GripVertical, Pencil, Trash2, Download, ArrowUpDown } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { z } from 'zod';
import { FormProvider, useForm } from 'react-hook-form';
import { db } from '@/db/database';
import type { CultivationLevel } from '@/db/types';
import { useBookIdParam } from '@/hooks/useBookIdParam';
import { useBookStore } from '@/store/useBookStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatStrip } from '@/components/common/StatStrip';
import { PageHeader } from '@/components/common/PageHeader';
import { ResourceFormDialog } from '@/components/common/ResourceFormDialog';
import { TextField, TextareaField } from '@/components/common/FormField';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/ResourcePage';
import { wordCount, cn } from '@/lib/utils';

const cultivationFormSchema = z.object({
  name: z.string().min(1, '境界名称不能为空').max(20, '不能超过 20 字'),
  level: z.coerce.number().int('层级必须是整数').min(1, '层级 ≥ 1').max(99, '层级 ≤ 99'),
  description: z.string().max(1000, '不能超过 1000 字'),
  abilities: z.string().max(2000, '能力描述不能超过 2000 字'),
});

type CultivationFormValues = z.infer<typeof cultivationFormSchema>;

export default function Cultivation() {
  const bookId = useBookIdParam();
  const setCurrentBookId = useBookStore((s) => s.setCurrentBookId);

  React.useEffect(() => {
    if (bookId != null) setCurrentBookId(bookId);
  }, [bookId, setCurrentBookId]);

  // 拉取当前 bookId 的所有境界，按 level 升序
  const levels = useLiveQuery(
    () =>
      bookId == null
        ? []
        : db.cultivation_levels
            .where('bookId')
            .equals(bookId)
            .toArray()
            .then((arr) => arr.sort((a, b) => a.level - b.level)),
    [bookId],
  ) ?? [];

  const [openCreate, setOpenCreate] = React.useState(false);
  const [editing, setEditing] = React.useState<CultivationLevel | undefined>(undefined);
  const [deleting, setDeleting] = React.useState<CultivationLevel | undefined>(undefined);

  // 当前激活的境界（取中间或第一个，简化处理：标记为 level 最高的 "current"）
  const currentLevelId = React.useMemo(() => {
    if (levels.length === 0) return null;
    // 简单策略：标记"中等进度"为 current（约 60% 位置）
    const idx = Math.max(0, Math.floor(levels.length * 0.6) - 1);
    return levels[idx]?.id ?? null;
  }, [levels]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = levels.findIndex((l) => l.id === active.id);
    const newIndex = levels.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    // 计算新的 level 序列（保持连续 1..N）
    const reordered = arrayMove(levels, oldIndex, newIndex);
    // 写入新 level 值
    await db.transaction('rw', db.cultivation_levels, async () => {
      for (let i = 0; i < reordered.length; i++) {
        const it = reordered[i];
        if (it.id && it.level !== i + 1) {
          await db.cultivation_levels.update(it.id, { level: i + 1 });
        }
      }
    });
  };

  // 提交（新建 / 编辑）
  const onSubmit = async (values: CultivationFormValues) => {
    if (bookId == null) return;
    const payload: Omit<CultivationLevel, 'id'> & { id?: number } = {
      bookId,
      name: values.name,
      level: values.level,
      description: values.description,
      abilities: values.abilities,
    };
    if (editing?.id) {
      await db.cultivation_levels.update(editing.id, payload);
    } else {
      await db.cultivation_levels.add(payload as CultivationLevel);
    }
    setEditing(undefined);
  };

  const onConfirmDelete = async () => {
    if (deleting?.id) {
      await db.cultivation_levels.delete(deleting.id);
    }
    setDeleting(undefined);
  };

  if (bookId == null) {
    return <div className="text-sm text-2 p-8">未指定书籍 ID。</div>;
  }

  return (
    <div className="w-full max-w-4xl">
      <PageHeader
          eyebrow="LEVEL 3 · 世界观搭建"
        title="修行境界"
        subtitle={
          levels.length === 0
            ? '定义小说中的修行体系。至少 3 个境界完成 Level 4。'
            : `已建立 ${levels.length} 个境界。拖拽手柄可调整顺序。`
        }
        actions={
          <>
            <Button type="button" size="sm" variant="ghost" title="自动排序" onClick={autoSort}>
              <ArrowUpDown className="w-3 h-3" strokeWidth={1.5} />
              自动排序
            </Button>
            <Button type="button" size="sm" variant="ghost" title="导出">
              <Download className="w-3 h-3" strokeWidth={1.5} />
              导出
            </Button>
            <Button type="button" size="sm" variant="primary" onClick={() => setOpenCreate(true)}>
              <Plus className="w-3 h-3" strokeWidth={1.5} />
              新增境界
            </Button>
          </>
        }
      />

      {/* 进度条 */}
      <div className="bd p-4 mb-6 flex items-center gap-6">
        <div>
          <div className="text-xs tnum text-3 mb-1">完成度</div>
          <div className="text-2xl font-semibold tnum">
            {Math.min(levels.length, 3)}
            <span className="text-base text-3">/3</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-mono tnum tracking-tight mb-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={i < levels.length ? 'text-text' : 'text-3'}>
                {`━━ `.repeat(3).trim()}
                {i < 2 ? ' ' : ''}
              </span>
            ))}
          </div>
          <div className="text-xs text-3">
            {levels.length >= 3
              ? '✓ 已完成 Level 4'
              : `再添加 ${3 - levels.length} 个境界即可完成 Level 4`}
          </div>
        </div>
        <Button type="button" size="sm" variant="primary" onClick={() => setOpenCreate(true)}>
          + 添加境界
        </Button>
      </div>

      <StatStrip
        className="mb-6"
        items={[
          { label: '已定义', value: levels.length },
          { label: '最高层级', value: levels.length > 0 ? levels[levels.length - 1].level : 0 },
          { label: '能力总数', value: levels.reduce((s, l) => s + wordCount(l.abilities), 0) },
          {
            label: '平均描述字数',
            value:
              levels.length > 0
                ? Math.round(levels.reduce((s, l) => s + wordCount(l.description), 0) / levels.length)
                : 0,
          },
        ]}
      />

      {/* 排序列表 */}
      {levels.length === 0 ? (
        <EmptyState
          title="还没有境界"
          hint="从创建一个基础境界开始，例如「炼气期」。"
          action={
            <Button type="button" size="sm" variant="primary" onClick={() => setOpenCreate(true)}>
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              新增境界
            </Button>
          }
        />
      ) : (
        <>
          <div className="text-xs tnum text-2 mb-3 font-mono">从低到高排列 · 拖拽 ⠿ 调整</div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={levels.map((l) => l.id ?? l.name)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0">
                {levels.map((lv) => (
                  <SortableLevelRow
                    key={lv.id}
                    level={lv}
                    isCurrent={lv.id === currentLevelId}
                    onEdit={() => setEditing(lv)}
                    onDelete={() => setDeleting(lv)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="bd border-dashed p-6 mt-3 flex items-center justify-center text-text-2">
            <div className="text-center">
              <Plus className="w-5 h-5 mx-auto mb-2" strokeWidth={1.5} />
              <div className="text-sm">
                <button
                  type="button"
                  className="hover:text-text"
                  onClick={() => setOpenCreate(true)}
                >
                  + 添加新境界
                </button>
              </div>
              <div className="text-xs text-3 mt-1">
                Lv.{levels.length + 1} · 元婴期 / 化神期 / 渡劫期 / 大乘期
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dialogs */}
      <CultivationFormDialog
        open={openCreate}
        onOpenChange={(v) => {
          setOpenCreate(v);
          if (!v) setEditing(undefined);
        }}
        bookId={bookId}
        nextLevel={levels.length + 1}
        onSubmit={onSubmit}
      />
      <CultivationFormDialog
        open={Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) setEditing(undefined);
        }}
        bookId={bookId}
        level={editing}
        onSubmit={onSubmit}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => {
          if (!v) setDeleting(undefined);
        }}
        title="删除境界"
        description={
          deleting
            ? `确定要删除「${deleting.name}」？此操作不可撤销。`
            : '确定要删除这个境界？此操作不可撤销。'
        }
        confirmText="删除"
        onConfirm={onConfirmDelete}
      />
    </div>
  );

  // 自动按 level 字段升序重新写入
  async function autoSort() {
    if (bookId == null) return;
    const sorted = [...levels].sort((a, b) => a.level - b.level);
    await db.transaction('rw', db.cultivation_levels, async () => {
      for (let i = 0; i < sorted.length; i++) {
        const it = sorted[i];
        if (it.id && it.level !== i + 1) {
          await db.cultivation_levels.update(it.id, { level: i + 1 });
        }
      }
    });
  }
}

// =============================================================================
// SortableLevelRow —— 可拖拽的境界行
// =============================================================================

function SortableLevelRow({
  level,
  isCurrent,
  onEdit,
  onDelete,
}: {
  level: CultivationLevel;
  isCurrent: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: level.id ?? level.name,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'grid grid-cols-12 gap-4 items-center px-4 py-4 border bg-bg cursor-pointer transition-colors',
        isDragging && 'opacity-50',
        'border-border hover:border-text',
        'mb-[-1px]',
      )}
    >
      {/* Drag handle */}
      <div
        className={cn(
          'col-span-1 flex flex-col gap-0.5 cursor-grab active:cursor-grabbing text-3',
        )}
        title="拖拽"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" strokeWidth={1.5} />
      </div>

      <div className="col-span-3">
        <div className="text-md font-semibold text-text">{level.name}</div>
        <div className="text-xs tnum font-mono text-3">
          Lv.{String(level.level).padStart(2, '0')}
          {isCurrent && <span className="ml-1 text-text">· 当前境界</span>}
        </div>
      </div>

      <div className="col-span-5 text-sm leading-relaxed text-text">
        {level.description ? level.description : <span className="text-3 italic">暂无描述</span>}
      </div>

      <div className="col-span-2 text-xs tnum font-mono text-3">
        {wordCount(level.abilities)} 能力
      </div>

      <div className="col-span-1 flex items-center gap-1 justify-end">
        <button
          type="button"
          onClick={onEdit}
          className="w-7 h-7 inline-flex items-center justify-center border border-border hover:border-text transition-colors"
          title="编辑"
        >
          <Pencil className="w-3 h-3" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="w-7 h-7 inline-flex items-center justify-center border border-border hover:border-text transition-colors"
          title="删除"
        >
          <Trash2 className="w-3 h-3" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// CultivationFormDialog —— 境界表单
// =============================================================================

function CultivationFormDialog({
  open,
  onOpenChange,
  bookId: _bookId,
  level,
  nextLevel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookId: number;
  level?: CultivationLevel;
  nextLevel?: number;
  onSubmit: (values: CultivationFormValues) => Promise<void> | void;
}) {
  const defaultValues: CultivationFormValues = {
    name: level?.name ?? '',
    level: level?.level ?? nextLevel ?? 1,
    description: level?.description ?? '',
    abilities: level?.abilities ?? '',
  };

  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={level ? `编辑境界 · ${level.name}` : '新增境界'}
      description={level ? '修改境界的属性，保存后立即生效' : '添加一个新的修行境界'}
      schema={cultivationFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitText={level ? '保存' : '创建'}
      contentClassName="max-w-xl"
    >
      {() => (
        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-7">
              <TextField name="name" label="境界名称" required placeholder="例：炼气期" />
            </div>
            <div className="col-span-5">
              <TextField name="level" type="number" label="层级 (Lv.)" required />
            </div>
          </div>
          <TextareaField
            name="description"
            label="描述"
            placeholder="境界的特点、突破条件、寿元等…"
            rows={4}
          />
          <TextareaField
            name="abilities"
            label="能力"
            placeholder="该境界具备的能力，列表或段落均可…"
            rows={5}
          />
        </div>
      )}
    </ResourceFormDialog>
  );
}
