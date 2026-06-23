// =============================================================================
// Characters page —— 人物库（列表 + 筛选 + 搜索 + 增删改）
// UI 对齐 mockups/characters.html
// =============================================================================

import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, GitFork, Download, Upload } from 'lucide-react';
import { db } from '@/db/database';
import { syncCharacterToGraph, deleteCharacterGraphNode } from '@/db/syncGraph';
import type { Character, CharacterCategory, Faction } from '@/db/types';
import { useBookIdParam } from '@/hooks/useBookIdParam';
import { useBookStore } from '@/store/useBookStore';
import { ResourcePage, EmptyState } from '@/components/common/ResourcePage';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { FilterTabs, FilterDivider } from '@/components/common/FilterTabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CharacterShape, CHARACTER_CATEGORY_LABELS, CHARACTER_CATEGORY_OPTIONS } from '@/components/character/CharacterShape';
import { CharacterFormDialog } from '@/components/character/CharacterFormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import type { CharacterFormValues } from '@/components/character/characterFormSchema';

type FilterValue = 'all' | CharacterCategory;

export default function Characters() {
  const bookId = useBookIdParam();
  const navigate = useNavigate();
  const setCurrentBookId = useBookStore((s) => s.setCurrentBookId);

  React.useEffect(() => {
    if (bookId != null) setCurrentBookId(bookId);
  }, [bookId, setCurrentBookId]);

  const [filter, setFilter] = React.useState<FilterValue>('all');
  const [search, setSearch] = React.useState('');
  const [openCreate, setOpenCreate] = React.useState(false);
  const [editing, setEditing] = React.useState<Character | undefined>(undefined);
  const [deleting, setDeleting] = React.useState<Character | undefined>(undefined);

  // 查询当前 bookId 的人物
  const characters = useLiveQuery(
    () => (bookId == null ? [] : db.characters.where('bookId').equals(bookId).toArray()),
    [bookId],
  ) ?? [];

  const factions = useLiveQuery(
    () => (bookId == null ? [] : db.factions.where('bookId').equals(bookId).toArray()),
    [bookId],
  ) ?? [];

  // 过滤 + 搜索
  const filtered = React.useMemo(() => {
    let list = characters;
    if (filter !== 'all') list = list.filter((c) => c.category === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    // 主角 → 反派 → 配角 → NPC
    const order: Record<CharacterCategory, number> = {
      protagonist: 0,
      villain: 1,
      supporting: 2,
      npc: 3,
    };
    return [...list].sort((a, b) => order[a.category] - order[b.category]);
  }, [characters, filter, search]);

  // 统计
  const counts = React.useMemo(() => {
    const c: Record<CharacterCategory, number> = {
      protagonist: 0,
      supporting: 0,
      villain: 0,
      npc: 0,
    };
    characters.forEach((x) => c[x.category]++);
    return c;
  }, [characters]);

  const factionMap = React.useMemo(() => {
    const m: Record<number, Faction> = {};
    factions.forEach((f) => {
      if (f.id != null) m[f.id] = f;
    });
    return m;
  }, [factions]);

  // 提交（新建 / 编辑）
  const onSubmit = async (values: CharacterFormValues) => {
    if (bookId == null) return;
    const payload: Omit<Character, 'id'> & { id?: number } = {
      bookId,
      name: values.name,
      gender: values.gender,
      height: values.height,
      weight: values.weight,
      personality: values.personality,
      appearance: values.appearance,
      category: values.category,
      factionId: values.factionId,
      avatarColor: values.avatarColor,
      notes: values.notes,
      createdAt: editing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    if (editing?.id) {
      await db.characters.update(editing.id, payload);
      await syncCharacterToGraph(editing.id);
    } else {
      const newId = (await db.characters.add(payload as Character)) as number;
      await syncCharacterToGraph(newId);
    }
    setEditing(undefined);
  };

  // 删除
  const onConfirmDelete = async () => {
    if (deleting?.id) {
      await deleteCharacterGraphNode(deleting.id);
      await db.characters.delete(deleting.id);
    }
    setDeleting(undefined);
  };

  // 表格列
  const columns: DataTableColumn<Character>[] = [
    {
      key: 'name',
      header: '姓名',
      width: '2.4fr',
      render: (c) => (
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-semibold truncate">{c.name}</div>
          <div className="hidden sm:block text-xs text-3 truncate">
            {c.personality ? c.personality.slice(0, 30) + (c.personality.length > 30 ? '…' : '') : '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: '类型',
      width: '0.7fr',
      render: (c) => <div className="text-xs sm:text-sm">{CHARACTER_CATEGORY_LABELS[c.category]}</div>,
    },
    {
      key: 'faction',
      header: '所属阵营',
      width: '1.1fr',
      render: (c) => (
        <div className="text-xs sm:text-sm text-2 truncate">
          {c.factionId ? (factionMap[c.factionId]?.name ?? '—') : '— 无'}
        </div>
      ),
    },
    {
      key: 'gender',
      header: '性别',
      width: '0.6fr',
      hideOnMobile: true,
      render: (c) => <div className="text-xs sm:text-sm text-2 tnum font-mono">{c.gender}</div>,
    },
  ];

  // 筛选 tabs
  const filterItems = [
    { value: 'all' as FilterValue, label: '全部', count: characters.length },
    ...CHARACTER_CATEGORY_OPTIONS.map((o) => ({
      value: o.value as FilterValue,
      label: (
        <span className="inline-flex items-center gap-1.5">
          <CharacterShape kind={o.value as CharacterCategory} size={10} />
          {o.label}
        </span>
      ),
      count: counts[o.value as CharacterCategory],
    })),
  ];

  if (bookId == null) {
    return (
      <div className="text-sm text-2 p-8">未指定书籍 ID，请从首页进入。</div>
    );
  }

  return (
    <>
      <ResourcePage
          eyebrow="LEVEL 2 · 角色入库"
        title="人物库"
        subtitle={
          characters.length === 0
            ? '还没有创建任何人物。建立至少 3 个人物完成 Level 2。'
            : `小说中的所有角色。已建立 ${characters.length} 人${
                counts.protagonist > 0 ? `，主角 ${counts.protagonist} 人` : ''
              }。`
        }
        primaryAction={{ label: '新建人物', onClick: () => setOpenCreate(true) }}
        secondaryActions={
          <>
            <Button type="button" size="sm" variant="ghost" title="导入">
              <Upload className="w-3 h-3" strokeWidth={1.5} />
              导入
            </Button>
            <Button type="button" size="sm" variant="ghost" title="导出 JSON">
              <Download className="w-3 h-3" strokeWidth={1.5} />
              导出
            </Button>
            <Link
              to={`/book/${bookId}/relationships`}
              className="inline-flex items-center gap-1.5 h-6 px-2.5 text-xs border border-border hover:border-text"
            >
              <GitFork className="w-3 h-3" strokeWidth={1.5} />
              查看关系网
            </Link>
          </>
        }
        stats={[
          { label: '总人数', value: characters.length },
          { label: '主角', value: counts.protagonist, marker: <CharacterShape kind="protagonist" size={10} /> },
          { label: '配角', value: counts.supporting, marker: <CharacterShape kind="supporting" size={10} /> },
          {
            label: '反派',
            value: counts.villain,
            marker: <CharacterShape kind="villain" size={10} />,
          },
          { label: 'NPC', value: counts.npc, marker: <CharacterShape kind="npc" size={10} /> },
        ]}
        filters={{ items: filterItems, value: filter, onChange: setFilter }}
        search={{ value: search, onChange: setSearch, placeholder: '按姓名搜索…' }}
        empty={characters.length === 0}
        emptyState={
          <EmptyState
            title="还没有人物"
            hint="从创建主角开始。点击下方按钮添加你的第一个角色。"
            action={
              <Button type="button" size="sm" variant="primary" onClick={() => setOpenCreate(true)}>
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                新建人物
              </Button>
            }
          />
        }
      >
        {filtered.length === 0 ? (
          <div className="bd p-8 text-center text-sm text-2">
            {search || filter !== 'all' ? '没有符合筛选条件的人物。' : '还没有人物。'}
          </div>
        ) : (
          <DataTable
            items={filtered}
            columns={columns}
            rowKey={(c) => c.id ?? c.name}
            rowIcon={(c) => null}
            onRowClick={(c) => {
              if (c.id != null) {
                navigate(`/book/${bookId}/characters/${c.id}`);
              }
            }}
            noChevron={false}
          />
        )}
      </ResourcePage>

      <CharacterFormDialog
        open={openCreate}
        onOpenChange={(v) => {
          setOpenCreate(v);
          if (!v) setEditing(undefined);
        }}
        bookId={bookId}
        onSubmit={onSubmit}
      />

      <CharacterFormDialog
        open={Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) setEditing(undefined);
        }}
        character={editing}
        bookId={bookId}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => {
          if (!v) setDeleting(undefined);
        }}
        title="删除人物"
        description={
          deleting
            ? `确定要删除「${deleting.name}」？此操作不可撤销。`
            : '确定要删除这个人物？此操作不可撤销。'
        }
        confirmText="删除"
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
