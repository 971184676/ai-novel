// =============================================================================
// World page —— 世界观设定（每本书一条记录）
// UI 对齐 mockups/world.html：单列长表单、字段间 1px 分隔
// =============================================================================

import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, History, Check } from 'lucide-react';
import { z } from 'zod';
import { db } from '@/db/database';
import type { WorldSetting } from '@/db/types';
import { useBookIdParam } from '@/hooks/useBookIdParam';
import { useBookStore } from '@/store/useBookStore';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { TextField, TextareaField, EnumBadgeField } from '@/components/common/FormField';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDateTime, wordCount } from '@/lib/utils';
import { cn } from '@/lib/utils';

// 小说类型枚举（与 mockup world.html 中的 11 个徽章对齐）
const GENRE_OPTIONS = [
  { value: '仙侠', label: '仙侠' },
  { value: '玄幻', label: '玄幻' },
  { value: '奇幻', label: '奇幻' },
  { value: '武侠', label: '武侠' },
  { value: '都市', label: '都市' },
  { value: '历史', label: '历史' },
  { value: '科幻', label: '科幻' },
  { value: '悬疑', label: '悬疑' },
  { value: '言情', label: '言情' },
  { value: '军事', label: '军事' },
  { value: '游戏', label: '游戏' },
  { value: '体育', label: '体育' },
  { value: 'custom', label: '自定义' },
];

// 表单 schema（zod + 中文错误）
const worldFormSchema = z.object({
  name: z
    .string()
    .min(1, '世界名称不能为空')
    .max(30, '名称不能超过 30 字'),
  genre: z.string().min(1, '请选择小说类型'),
  background: z
    .string()
    .min(1, '世界背景不能为空')
    .max(2000, '背景不能超过 2000 字'),
  coreRules: z
    .string()
    .max(2000, '核心规则不能超过 2000 字'),
  energySystem: z.string().max(1000, '能量体系不能超过 1000 字'),
  socialStructure: z.string().max(1000, '社会结构不能超过 1000 字'),
  terms: z.string().max(1000, '关键术语不能超过 1000 字'),
  notes: z.string().max(2000, '备注不能超过 2000 字'),
});

type WorldFormValues = z.infer<typeof worldFormSchema>;

/** 把 WorldSetting 记录 → 表单值（含 4 个 mockup 字段：genre / energySystem / socialStructure / terms） */
function splitNotes(record: WorldSetting | undefined): {
  genre: string;
  energySystem: string;
  socialStructure: string;
  terms: string;
  notes: string;
} {
  const raw = record?.notes ?? '';
  // 段落分隔：每段以 "## xxx\n" 开头
  const sections: Record<string, string> = {
    genre: '',
    energySystem: '',
    socialStructure: '',
    terms: '',
    notes: '',
  };
  if (raw.includes('## ')) {
    const lines = raw.split('\n');
    let cur = 'notes';
    for (const line of lines) {
      const m = line.match(/^##\s*(.+?)\s*$/);
      if (m) {
        const title = m[1].trim();
        if (title === '类型') cur = 'genre';
        else if (title === '能量体系') cur = 'energySystem';
        else if (title === '社会结构') cur = 'socialStructure';
        else if (title === '关键术语') cur = 'terms';
        else if (title === '备注') cur = 'notes';
        else cur = 'notes';
        continue;
      }
      sections[cur] = (sections[cur] ? sections[cur] + '\n' : '') + line;
    }
  } else {
    sections.notes = raw;
  }
  return {
    genre: sections.genre.trim(),
    energySystem: sections.energySystem.trim(),
    socialStructure: sections.socialStructure.trim(),
    terms: sections.terms.trim(),
    notes: sections.notes.trim(),
  };
}

/** 把表单值合并回 notes（带 section 标记） */
function joinNotes(values: WorldFormValues): string {
  const parts: string[] = [];
  if (values.genre) parts.push(`## 类型\n${values.genre}`);
  if (values.energySystem) parts.push(`## 能量体系\n${values.energySystem}`);
  if (values.socialStructure) parts.push(`## 社会结构\n${values.socialStructure}`);
  if (values.terms) parts.push(`## 关键术语\n${values.terms}`);
  if (values.notes) parts.push(`## 备注\n${values.notes}`);
  return parts.join('\n\n');
}

export default function World() {
  const bookId = useBookIdParam();
  const setCurrentBookId = useBookStore((s) => s.setCurrentBookId);

  React.useEffect(() => {
    if (bookId != null) setCurrentBookId(bookId);
  }, [bookId, setCurrentBookId]);

  // 查询当前 bookId 的世界设定
  const [isLoading, setIsLoading] = React.useState(true);
  const [queryError, setQueryError] = React.useState<string | null>(null);
  const record = useLiveQuery(
    async () => {
      try {
        if (bookId == null) return undefined;
        const all = await db.world_settings.where('bookId').equals(bookId).toArray();
        return all[0];
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setQueryError(msg);
        return undefined;
      }
    },
    [bookId],
  );

  React.useEffect(() => {
    // 最多等待 600ms，避免无数据时永远显示加载中
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, [bookId]);

  React.useEffect(() => {
    if (record !== undefined) setIsLoading(false);
  }, [record]);

  // form state —— 直接放在页面（不放在 dialog）
  const methods = useForm<WorldFormValues>({
    // Cast to any: @hookform/resolvers v5 + zod v4 input/output split
    // (due to .default() in schema) makes the strict Resolver<T> overload
    // impossible to satisfy. The runtime pairing is correct.
    resolver: zodResolver(worldFormSchema) as any,
    defaultValues: {
      name: '',
      genre: '',
      background: '',
      coreRules: '',
      energySystem: '',
      socialStructure: '',
      terms: '',
      notes: '',
    },
    mode: 'onBlur',
  });

  // 远端数据到达后写入表单
  React.useEffect(() => {
    if (record) {
      const split = splitNotes(record);
      methods.reset({
        name: record.name ?? '',
        genre: split.genre,
        background: record.background ?? '',
        coreRules: record.coreRules ?? '',
        energySystem: split.energySystem,
        socialStructure: split.socialStructure,
        terms: split.terms,
        notes: split.notes,
      });
    }
  }, [record, methods]);

  // 自动保存（防抖 500ms）
  const [savingState, setSavingState] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const watchAll = methods.watch();
  const lastSavedRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!bookId) return;
    if (!methods.formState.isDirty) return;
    const handle = setTimeout(async () => {
      const valid = await methods.trigger();
      if (!valid) return;
      const values = methods.getValues();
      const payload = {
        bookId,
        name: values.name,
        background: values.background,
        coreRules: values.coreRules,
        notes: joinNotes(values),
        updatedAt: new Date(),
      };
      const key = JSON.stringify(payload);
      if (key === lastSavedRef.current) return;
      setSavingState('saving');
      if (record?.id) {
        await db.world_settings.update(record.id, payload);
      } else {
        await db.world_settings.add(payload as WorldSetting);
      }
      lastSavedRef.current = key;
      setSavingState('saved');
      setTimeout(() => setSavingState('idle'), 1500);
    }, 500);
    return () => clearTimeout(handle);
  }, [JSON.stringify(watchAll), bookId, record?.id, methods]);

  // 显式保存（按钮触发）
  const onSave = async () => {
    const valid = await methods.trigger();
    if (!valid) return;
    const values = methods.getValues();
    const payload = {
      bookId: bookId!,
      name: values.name,
      background: values.background,
      coreRules: values.coreRules,
      notes: joinNotes(values),
      updatedAt: new Date(),
    };
    setSavingState('saving');
    if (record?.id) {
      await db.world_settings.update(record.id, payload);
    } else {
      await db.world_settings.add(payload as WorldSetting);
    }
    setSavingState('saved');
    setTimeout(() => setSavingState('idle'), 1500);
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl text-sm text-2 p-8">加载中…</div>
    );
  }

  if (queryError) {
    return (
      <div className="max-w-3xl p-8 border-2 border-text bg-bg shadow-[0_4px_0_0_#000]">
        <div className="text-sm font-semibold mb-2">数据加载失败</div>
        <div className="text-xs text-2 mb-4">{queryError}</div>
        <Button type="button" size="sm" variant="primary" onClick={() => window.location.reload()}>
          刷新重试
        </Button>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <div className="max-w-3xl w-full">
        <PageHeader
          eyebrow="LEVEL 1 · 开局构思"
          title="世界观设定"
          subtitle="定义故事发生的世界。背景、规则、能量体系、社会结构是人物和剧情的根基。"
          actions={
            <>
              <span
                className={cn(
                  'text-xs tnum mr-2',
                  savingState === 'saving' ? 'text-2' : 'text-3',
                )}
              >
                {savingState === 'saving'
                  ? '保存中…'
                  : savingState === 'saved'
                  ? '已保存'
                  : record
                  ? `自动保存 · ${formatDateTime(record.updatedAt)}`
                  : '尚未保存'}
              </span>
              <Button type="button" size="sm" variant="ghost" title="历史版本">
                <History className="w-3 h-3" strokeWidth={1.5} />
                历史版本
              </Button>
              <Button type="button" size="sm" variant="primary" onClick={onSave}>
                {savingState === 'saved' ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                保存
              </Button>
            </>
          }
        />

        <form onSubmit={(e) => e.preventDefault()} className="space-y-0">
          {/* 01 世界名称 */}
          <FieldGroup ord="01" name="世界名称" required hint="可以是大陆名、位面名或抽象命名。避免用「修真世界」等通名。">
            <TextField name="name" placeholder="例：九州仙途 · 玄天大陆" required />
          </FieldGroup>

          {/* 02 小说类型 */}
          <FieldGroup ord="02" name="小说类型">
            <EnumBadgeField name="genre" options={GENRE_OPTIONS} />
          </FieldGroup>

          {/* 03 世界背景 */}
          <FieldGroup
            ord="03"
            name="世界背景"
            required
            hint="建议包含：地理、时代背景、关键历史事件、故事开始的契机。"
            count={`${wordCount(methods.watch('background'))} / 2000`}
          >
            <TextareaField name="background" rows={10} placeholder="描述世界的地理、历史、时代背景…" required />
          </FieldGroup>

          {/* 04 核心规则 */}
          <FieldGroup
            ord="04"
            name="核心规则"
            optional
            count={`${wordCount(methods.watch('coreRules'))} / 2000`}
          >
            <TextareaField name="coreRules" rows={6} placeholder="能量来源 / 修行体系 / 等级突破条件 / 律法契约…" />
          </FieldGroup>

          {/* 05 能量体系 */}
          <FieldGroup
            ord="05"
            name="能量体系"
            optional
            count={`${wordCount(methods.watch('energySystem'))} / 1000`}
          >
            <TextareaField name="energySystem" rows={5} placeholder="灵气 / 真元 / 五行 / 异能…" />
          </FieldGroup>

          {/* 06 社会结构 */}
          <FieldGroup
            ord="06"
            name="社会结构"
            optional
            count={`${wordCount(methods.watch('socialStructure'))} / 1000`}
          >
            <TextareaField name="socialStructure" rows={4} placeholder="皇朝 / 朝廷 / 宗门 / 江湖…" />
          </FieldGroup>

          {/* 07 关键术语（用换行或逗号分隔） */}
          <FieldGroup
            ord="07"
            name="关键术语"
            optional
            hint="术语会在 AI 扩写时自动注入提示词，无需手动维护关联。"
          >
            <TextareaField name="terms" rows={3} placeholder="丹田 / 真元 / 神识 / 剑诀 …（用换行或逗号分隔）" />
          </FieldGroup>

          {/* 08 备注 */}
          <FieldGroup
            ord="08"
            name="备注"
            optional
            count={`${wordCount(methods.watch('notes'))} / 2000`}
          >
            <TextareaField name="notes" rows={3} placeholder="设定笔记、灵感来源、待办…" />
          </FieldGroup>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <Link
              to={bookId != null ? `/book/${bookId}` : '/'}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-sm text-text border border-border hover:border-text"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              返回总览
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs tnum text-3">
                完成度{' '}
                {[
                  methods.watch('name'),
                  methods.watch('genre'),
                  methods.watch('background'),
                  methods.watch('coreRules'),
                ].filter(Boolean).length}{' '}
                / 4
              </span>
              <Button type="button" size="sm" variant="primary" onClick={onSave}>
                <Check className="w-3 h-3" strokeWidth={1.5} />
                完成 Level 1
              </Button>
            </div>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}

/** 字段块：ord 序号 + 名称 + 必填标记 + 描述 + 计数器 */
function FieldGroup({
  ord,
  name,
  required,
  optional,
  hint,
  count,
  children,
}: {
  ord: string;
  name: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-6 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-md font-semibold">
          <span className="font-mono tnum text-3 text-xs font-normal">{ord}</span>
          <span>{name}</span>
          {required && (
            <span className="ml-1 text-xs font-mono tnum text-3 font-normal">REQUIRED</span>
          )}
          {optional && (
            <span className="ml-1 text-xs font-mono tnum text-3 font-normal">OPTIONAL</span>
          )}
        </div>
        {count && <div className="text-xs tnum text-3 font-mono">{count}</div>}
      </div>
      {children}
      {hint && <p className="text-xs text-3 mt-2 leading-relaxed">{hint}</p>}
    </div>
  );
}
