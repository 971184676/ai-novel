// =============================================================================
// Skills page —— 技能 CRUD
// UI 对齐 mockups/skills.html：卡片网格
// =============================================================================

import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Download, LayoutGrid, List, BookOpen, Sword, Zap, Wind, Moon, Flame } from 'lucide-react';
import { z } from 'zod';
import { db } from '@/db/database';
import type { Skill, SkillType } from '@/db/types';
import { useBookIdParam } from '@/hooks/useBookIdParam';
import { useBookStore } from '@/store/useBookStore';
import { ResourcePage, EmptyState } from '@/components/common/ResourcePage';
import { ResourceFormDialog } from '@/components/common/ResourceFormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TextField, TextareaField, SelectField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatStrip } from '@/components/common/StatStrip';
import { FilterTabs } from '@/components/common/FilterTabs';
import { cn, wordCount } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const SKILL_TYPE_LABELS: Record<SkillType, string> = {
  technique: '功法',
  martial_art: '武技',
  skill: '特殊',
};
const SKILL_TYPE_OPTIONS = (Object.keys(SKILL_TYPE_LABELS) as SkillType[]).map((v) => ({
  value: v,
  label: SKILL_TYPE_LABELS[v],
}));

const SKILL_TYPE_ICON: Record<SkillType, LucideIcon> = {
  technique: BookOpen,
  martial_art: Sword,
  skill: Zap,
};

// 品级
const RANK_LEVELS = ['下品', '中品', '上品', '极品'] as const;
const RANK_OPTIONS = RANK_LEVELS.map((v) => ({ value: v, label: v }));
type Rank = (typeof RANK_LEVELS)[number];

function TierStrip({ rank }: { rank: string }) {
  const idx = RANK_LEVELS.indexOf(rank as Rank);
  const safeIdx = idx >= 0 ? idx : 1;
  const lines = safeIdx + 2;
  return (
    <span
      className={cn(
        'font-mono tnum leading-none tracking-tight text-xs',
        safeIdx >= 2 ? 'text-text' : 'text-2',
        safeIdx === 3 && 'font-semibold',
      )}
    >
      {'━━ '.repeat(lines).trim()}
    </span>
  );
}

const skillFormSchema = z.object({
  name: z.string().min(1, '技能名称不能为空').max(30, '不能超过 30 字'),
  type: z.enum(['technique', 'martial_art', 'skill'] as const, {
    message: '请选择技能类型',
  }),
  attribute: z.string().max(50, '属性不能超过 50 字'),
  effects: z.string().max(2000, '效果不能超过 2000 字'),
  rank: z.string().max(20, '品级不能超过 20 字'),
  description: z.string().max(1000, '不能超过 1000 字'),
});

type SkillFormValues = z.infer<typeof skillFormSchema>;

type FilterValue = 'all' | SkillType;

export default function Skills() {
  const bookId = useBookIdParam();
  const setCurrentBookId = useBookStore((s) => s.setCurrentBookId);

  React.useEffect(() => {
    if (bookId != null) setCurrentBookId(bookId);
  }, [bookId, setCurrentBookId]);

  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = React.useState<FilterValue>('all');
  const [search, setSearch] = React.useState('');
  const [openCreate, setOpenCreate] = React.useState(false);
  const [editing, setEditing] = React.useState<Skill | undefined>(undefined);
  const [deleting, setDeleting] = React.useState<Skill | undefined>(undefined);

  const items = useLiveQuery(
    () => (bookId == null ? [] : db.skills.where('bookId').equals(bookId).toArray()),
    [bookId],
  ) ?? [];

  const filtered = React.useMemo(() => {
    let list = items;
    if (filter !== 'all') list = list.filter((s) => s.type === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.attribute.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, filter, search]);

  const counts = React.useMemo(() => {
    const c: Record<SkillType, number> = { technique: 0, martial_art: 0, skill: 0 };
    items.forEach((x) => c[x.type]++);
    return c;
  }, [items]);

  const onSubmit = async (values: SkillFormValues) => {
    if (bookId == null) return;
    const payload: Omit<Skill, 'id'> & { id?: number } = {
      bookId,
      name: values.name,
      type: values.type,
      attribute: values.attribute,
      effects: values.effects,
      rank: values.rank,
      description: values.description,
    };
    if (editing?.id) {
      await db.skills.update(editing.id, payload);
    } else {
      await db.skills.add(payload as Skill);
    }
    setEditing(undefined);
  };

  const onConfirmDelete = async () => {
    if (deleting?.id) {
      await db.skills.delete(deleting.id);
    }
    setDeleting(undefined);
  };

  const filterItems = [
    { value: 'all' as FilterValue, label: '全部', count: items.length },
    ...SKILL_TYPE_OPTIONS.map((o) => ({
      value: o.value as FilterValue,
      label: o.label,
      count: counts[o.value as SkillType],
    })),
  ];

  if (bookId == null) {
    return <div className="text-sm text-2 p-8">未指定书籍 ID。</div>;
  }

  return (
    <>
      <ResourcePage
        eyebrow="LEVEL 3 · 世界观搭建 / 技能"
        title="技能"
        subtitle={
          items.length === 0
            ? '管理功法、武技与特殊技能。'
            : `管理功法、武技与特殊技能。共 ${items.length} 个技能。`
        }
        primaryAction={{ label: '新建技能', onClick: () => setOpenCreate(true) }}
        secondaryActions={
          <>
            <Button type="button" size="sm" variant="ghost" title="导出">
              <Download className="w-3 h-3" strokeWidth={1.5} />
              导出
            </Button>
            <button
              type="button"
              onClick={() => setView('grid')}
              className={cn(
                'w-7 h-7 inline-flex items-center justify-center border',
                view === 'grid' ? 'border-text bg-text text-bg' : 'border-border hover:border-text',
              )}
              title="网格视图"
            >
              <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn(
                'w-7 h-7 inline-flex items-center justify-center border',
                view === 'list' ? 'border-text bg-text text-bg' : 'border-border hover:border-text',
              )}
              title="列表视图"
            >
              <List className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </>
        }
        stats={[
          { label: '总技能', value: items.length },
          { label: '功法', value: counts.technique },
          { label: '武技', value: counts.martial_art },
          { label: '特殊', value: counts.skill },
        ]}
        filters={{ items: filterItems, value: filter, onChange: setFilter }}
        search={{ value: search, onChange: setSearch, placeholder: '搜索技能…' }}
        empty={items.length === 0}
        emptyState={
          <EmptyState
            title="还没有技能"
            hint="从添加第一个技能开始 —— 功法、武技或特殊能力。"
            action={
              <Button type="button" size="sm" variant="primary" onClick={() => setOpenCreate(true)}>
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                新建技能
              </Button>
            }
          />
        }
      >
        {filtered.length === 0 ? (
          <div className="bd p-8 text-center text-sm text-2">
            {search || filter !== 'all' ? '没有符合筛选条件的技能。' : '还没有技能。'}
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((s) => {
              const Icon = SKILL_TYPE_ICON[s.type];
              return (
                <button
                  type="button"
                  key={s.id ?? s.name}
                  onClick={() => setEditing(s)}
                  className="text-left p-5 bd flex flex-col gap-3 hover:border-text"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 bd-strong flex items-center justify-center">
                      <Icon className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <TierStrip rank={s.rank} />
                  </div>
                  <div>
                    <h3 className="text-md font-semibold mb-1 leading-tight">{s.name}</h3>
                    <div className="text-xs text-3 tnum font-mono mb-2">
                      {SKILL_TYPE_LABELS[s.type]}
                      {s.attribute ? ` · ${s.attribute}` : ''}
                    </div>
                    <p className="text-xs text-2 leading-relaxed line-clamp-3">
                      {s.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    {s.attribute && <span className="text-2">{s.attribute}</span>}
                    <span className="ml-auto text-xs tnum text-3 font-mono">{s.rank}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bd">
            {filtered.map((s, i) => {
              const Icon = SKILL_TYPE_ICON[s.type];
              return (
                <button
                  type="button"
                  key={s.id ?? s.name}
                  onClick={() => setEditing(s)}
                  className={cn(
                    'w-full text-left grid grid-cols-12 gap-3 items-center px-4 py-3 hover:bg-surface',
                    i < filtered.length - 1 && 'border-b border-border',
                  )}
                >
                  <div className="col-span-1 flex items-center justify-center">
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <div className="col-span-3 min-w-0">
                    <div className="text-sm font-semibold truncate">{s.name}</div>
                    <div className="text-xs text-3 tnum">
                      {SKILL_TYPE_LABELS[s.type]}
                      {s.attribute ? ` · ${s.attribute}` : ''}
                    </div>
                  </div>
                  <div className="col-span-5 text-sm text-2 truncate">{s.description}</div>
                  <div className="col-span-2 text-xs">
                    <TierStrip rank={s.rank} />
                  </div>
                  <div className="col-span-1 text-right text-xs tnum text-3">
                    {wordCount(s.effects)} 效
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ResourcePage>

      <SkillFormDialog
        open={openCreate}
        onOpenChange={(v) => {
          setOpenCreate(v);
          if (!v) setEditing(undefined);
        }}
        onSubmit={onSubmit}
      />
      <SkillFormDialog
        open={Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) setEditing(undefined);
        }}
        skill={editing}
        onSubmit={onSubmit}
        onDelete={
          editing
            ? async () => {
                if (editing.id) await db.skills.delete(editing.id);
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
        title="删除技能"
        description={deleting ? `确定要删除「${deleting.name}」？` : '确定要删除这个技能？'}
        confirmText="删除"
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

function SkillFormDialog({
  open,
  onOpenChange,
  skill,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  skill?: Skill;
  onSubmit: (values: SkillFormValues) => Promise<void> | void;
  onDelete?: () => void;
}) {
  const defaultValues: SkillFormValues = {
    name: skill?.name ?? '',
    type: skill?.type ?? 'technique',
    attribute: skill?.attribute ?? '',
    effects: skill?.effects ?? '',
    rank: skill?.rank ?? '中品',
    description: skill?.description ?? '',
  };

  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={skill ? `编辑技能 · ${skill.name}` : '新建技能'}
      description={skill ? '修改技能的属性' : '添加一个新的技能'}
      schema={skillFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitText={skill ? '保存' : '创建'}
      onDelete={onDelete}
      contentClassName="max-w-2xl"
    >
      {() => (
        <div className="space-y-4">
          <TextField name="name" label="技能名称" required placeholder="例：青云心法" />

          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-5">
              <SelectField
                name="type"
                label="类型"
                required
                options={SKILL_TYPE_OPTIONS}
                placeholder="选择类型"
              />
            </div>
            <div className="col-span-4">
              <TextField
                name="attribute"
                label="属性"
                placeholder="例：金 / 木 / 水 / 火 / 土"
              />
            </div>
            <div className="col-span-3">
              <TextField
                name="rank"
                label="品级"
                placeholder="例：下品 / 中品 / 上品"
              />
            </div>
          </div>

          <TextareaField
            name="description"
            label="描述"
            placeholder="技能的来源、学习条件、表现形式…"
            rows={3}
          />

          <TextareaField
            name="effects"
            label="效果"
            placeholder="释放后的具体效果，属性加成、特殊能力…"
            rows={4}
          />
        </div>
      )}
    </ResourceFormDialog>
  );
}
