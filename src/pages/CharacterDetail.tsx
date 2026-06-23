// =============================================================================
// CharacterDetail page —— 单个人物详情（基础信息 + 性格外貌 + 关联 + 备注）
// UI 对齐 mockups/character-detail.html
// =============================================================================

import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Copy, Eye } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '@/db/database';
import { syncCharacterToGraph, deleteCharacterGraphNode } from '@/db/syncGraph';
import { useBookIdParam } from '@/hooks/useBookIdParam';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Divider } from '@/components/ui/divider';
import {
  TextField,
  TextareaField,
  EnumBadgeField,
  SelectField,
  ColorSwatchField,
} from '@/components/common/FormField';
import { characterFormSchema, GENDER_OPTIONS, type CharacterFormValues } from '@/components/character/characterFormSchema';
import { CharacterShape, CHARACTER_CATEGORY_LABELS } from '@/components/character/CharacterShape';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatDateTime, wordCount } from '@/lib/utils';

const AVATAR_SWATCHES = [
  '#000000',
  '#1F1F1F',
  '#3F3F3F',
  '#6B6B6B',
  '#8C8C8C',
  '#A3A3A3',
  '#D4D4D4',
  '#FFFFFF',
];

export default function CharacterDetail() {
  const bookId = useBookIdParam();
  const { id: charId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [initialLoading, setInitialLoading] = React.useState(true);
  const character = useLiveQuery(
    async () => {
      try {
        if (charId == null) return null;
        const n = Number(charId);
        if (!Number.isFinite(n)) return null;
        return (await db.characters.get(n)) ?? null;
      } catch {
        return null;
      }
    },
    [charId],
  );

  React.useEffect(() => {
    const timer = setTimeout(() => setInitialLoading(false), 600);
    return () => clearTimeout(timer);
  }, [charId]);

  React.useEffect(() => {
    if (character !== undefined) setInitialLoading(false);
  }, [character]);

  if (initialLoading) {
    return <div className="text-sm text-2 p-8">加载中…</div>;
  }

  if (character === null || !character) {
    return (
      <div className="max-w-2xl">
        <div className="text-xs tnum text-3 mb-2">404</div>
        <h1 className="text-2xl font-semibold mb-3">未找到该人物</h1>
        <p className="text-sm text-2 mb-6 leading-relaxed">
          该人物可能已被删除，或链接已失效。
        </p>
        <Link
          to={bookId != null ? `/book/${bookId}/characters` : '/'}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-sm border-2 border-text bg-bg shadow-[0_3px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#000] active:translate-y-[1px] active:shadow-[0_1px_0_0_#000] transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          返回人物库
        </Link>
      </div>
    );
  }

  const factions = useLiveQuery(
    () => (bookId == null ? [] : db.factions.where('bookId').equals(bookId).toArray()),
    [bookId],
  ) ?? [];

  const factionOptions = [
    { value: '', label: '— 无门派 / 暂无' },
    ...factions.map((f) => ({ value: String(f.id), label: f.name })),
  ];

  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const methods = useForm<CharacterFormValues>({
    // Cast to any: @hookform/resolvers v5 + zod v4 input/output split
    // (due to .transform() in schema) makes the strict Resolver<T> overload
    // impossible to satisfy. The runtime pairing is correct.
    resolver: zodResolver(characterFormSchema) as any,
    defaultValues: {
      name: '',
      gender: '男',
      height: undefined as any,
      weight: undefined as any,
      personality: '',
      appearance: '',
      category: 'supporting',
      factionId: undefined as any,
      avatarColor: '#000000',
      notes: '',
    },
    mode: 'onBlur',
  });

  React.useEffect(() => {
    if (character) {
      methods.reset({
        name: character.name,
        gender: (character.gender as any) ?? '男',
        height: character.height as any,
        weight: character.weight as any,
        personality: character.personality,
        appearance: character.appearance,
        category: character.category,
        factionId: character.factionId as any,
        avatarColor: character.avatarColor,
        notes: character.notes,
      });
    }
  }, [character, methods]);

  const onSubmit = methods.handleSubmit(async (values) => {
    if (!character?.id) return;
    await db.characters.update(character.id, {
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
      updatedAt: new Date(),
    });
    await syncCharacterToGraph(character.id);
  });

  const onDelete = async () => {
    if (!character?.id) return;
    await deleteCharacterGraphNode(character.id);
    await db.characters.delete(character.id);
    setConfirmDelete(false);
    navigate(`/book/${bookId}/characters`);
  };

  const factionName = character.factionId
    ? factions.find((f) => f.id === character.factionId)?.name
    : null;

  return (
    <FormProvider {...methods}>
      <div className="max-w-5xl w-full">
        {/* Profile header */}
        <header className="flex items-start justify-between gap-6 pb-4 mb-6">
          <div className="flex items-start gap-6 min-w-0">
            <div
              className="w-24 h-24 border border-text flex items-center justify-center shrink-0"
              style={{ background: character.avatarColor || '#000' }}
            >
              <CharacterShape kind={character.category} size={56} className="invert-on-dark" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs tnum text-3 mb-2 uppercase tracking-wider">
                CHARACTER · {CHARACTER_CATEGORY_LABELS[character.category]}
              </div>
              <h1 className="text-2xl font-semibold leading-tight mb-2">{character.name}</h1>
              <p className="text-sm text-2 leading-relaxed">
                {[
                  character.gender,
                  character.height ? `${character.height} cm` : null,
                  character.weight ? `${character.weight} kg` : null,
                  factionName,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <Badge variant="outline">{CHARACTER_CATEGORY_LABELS[character.category]}</Badge>
                {factionName && <Badge>{factionName}</Badge>}
                <Badge variant="muted">
                  创建于 {formatDateTime(character.createdAt).slice(0, 10)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs tnum text-3 mr-2">
              更新于 {formatDateTime(character.updatedAt)}
            </span>
            <Button type="button" size="sm" variant="ghost" title="预览">
              <Eye className="w-3 h-3" strokeWidth={1.5} />
              预览
            </Button>
            <Button type="button" size="sm" variant="ghost" title="复制">
              <Copy className="w-3 h-3" strokeWidth={1.5} />
              复制
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              title="删除"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-3 h-3" strokeWidth={1.5} />
              删除
            </Button>
          </div>
        </header>

        <Divider className="mb-6" />

        <form onSubmit={onSubmit} className="grid grid-cols-12 gap-10">
          {/* LEFT: form */}
          <section className="col-span-12 lg:col-span-8 space-y-5">
            {/* 基础信息 */}
            <div className="grid grid-cols-12 gap-3 items-start">
              <div className="col-span-7">
                <TextField name="name" label="姓名" required />
              </div>
              <div className="col-span-5">
                <ColorSwatchField
                  name="avatarColor"
                  swatches={AVATAR_SWATCHES}
                  label="头像颜色"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3 items-start">
              <div className="col-span-4">
                <EnumBadgeField name="category" label="类型" required options={[
                  { value: 'protagonist', label: '主角' },
                  { value: 'supporting', label: '配角' },
                  { value: 'villain', label: '反派' },
                  { value: 'npc', label: 'NPC' },
                ]} />
              </div>
              <div className="col-span-4">
                <EnumBadgeField name="gender" label="性别" required options={GENDER_OPTIONS} />
              </div>
              <div className="col-span-4 grid grid-cols-2 gap-2 items-start">
                <TextField name="height" type="number" label="身高 (cm)" placeholder="cm" />
                <TextField name="weight" type="number" label="体重 (kg)" placeholder="kg" />
              </div>
            </div>

            <SelectField
              name="factionId"
              options={factionOptions}
              label="所属阵营"
              placeholder="选择阵营（可选）"
            />

            <TextareaField
              name="personality"
              label="性格描述"
              placeholder="性格特点、价值观、处事方式…"
              rows={3}
              required
            />

            <TextareaField
              name="appearance"
              label="外貌描述"
              placeholder="身形、相貌、衣着、显著特征…"
              rows={3}
              required
            />

            <TextareaField
              name="notes"
              label="备注 / 设定笔记"
              placeholder="人物小传、灵感来源、与其他角色的伏笔…"
              rows={4}
            />

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-border">
              <Link
                to={bookId != null ? `/book/${bookId}/characters` : '/'}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-sm border border-border hover:border-text"
              >
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                返回人物库
              </Link>
              <div className="flex items-center gap-2">
                {bookId && (
                  <Link
                    to={`/book/${bookId}/relationships`}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-sm border border-border hover:border-text"
                  >
                    查看关系图
                  </Link>
                )}
                <Button type="submit" size="sm" variant="primary">
                  <Save className="w-3 h-3" strokeWidth={1.5} />
                  保存
                </Button>
              </div>
            </div>
          </section>

          {/* RIGHT: summary */}
          <aside className="col-span-12 lg:col-span-4 space-y-6">
            <div>
              <h2 className="text-xs uppercase tracking-wider text-2 font-medium mb-3">统计</h2>
              <div className="grid grid-cols-2 bd">
                <div className="p-4 border-r border-border">
                  <div className="text-xs tnum text-3 mb-1">字段字数</div>
                  <div className="text-xl font-semibold tnum">
                    {wordCount(character.personality) + wordCount(character.appearance)}
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-xs tnum text-3 mb-1">备注字数</div>
                  <div className="text-xl font-semibold tnum">{wordCount(character.notes)}</div>
                </div>
                <div className="p-4 col-span-2 border-t border-border">
                  <div className="text-xs tnum text-3 mb-1">总字数</div>
                  <div className="text-xl font-semibold tnum">
                    {wordCount(character.personality) +
                      wordCount(character.appearance) +
                      wordCount(character.notes)}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xs uppercase tracking-wider text-2 font-medium mb-3">基础信息</h2>
              <div className="bd p-4 space-y-2 text-sm">
                <Row label="类型" value={CHARACTER_CATEGORY_LABELS[character.category]} />
                <Row label="性别" value={character.gender} />
                <Row label="身高" value={character.height ? `${character.height} cm` : '—'} />
                <Row label="体重" value={character.weight ? `${character.weight} kg` : '—'} />
                <Row label="阵营" value={factionName ?? '— 无'} />
                <Row label="创建" value={formatDateTime(character.createdAt)} />
                <Row label="更新" value={formatDateTime(character.updatedAt)} />
              </div>
            </div>
          </aside>
        </form>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="删除人物"
        description={`确定要删除「${character.name}」？此操作不可撤销。`}
        confirmText="删除"
        onConfirm={onDelete}
      />
    </FormProvider>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs tnum text-3 font-mono">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
