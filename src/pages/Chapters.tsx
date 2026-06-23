// =============================================================================
// novel-ai-chapter-dev · 章节创作页
// 路径 /book/:bookId/chapters
// 严格对齐开发文档 9/10 节与 mockups/chapters.html：
//   - 左侧章节列表（chapterNumber 排序）+ 状态徽章 + 字数 + 更新时间
//   - 右侧详情：标题 / 编号 / 大纲 / 关联人物 / 关联地点 / TipTap 编辑器 / 状态机
//   - 大纲 ↔ 正文 Tab 切换
//   - 状态机：outline → expanded → edited → final（final 后需二次确认解锁）
//   - AI 扩写（流式）+ 重新生成 + 取消 + 字数统计
// =============================================================================

import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Feather,
  Plus,
  RefreshCcw,
  Save,
  Settings,
  Sparkles,
  Trash2,
  XCircle,
  ChevronRight,
  Square,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '@/db/database';
import type { Chapter, ChapterStatus, Character, GraphNode } from '@/db/types';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import {
  ChapterEditor,
  FinalStateToggle,
  computeWordCount,
} from '@/components/chapter/ChapterEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn, formatDateTime, wordCount } from '@/lib/utils';
import { buildContext } from '@/ai/contextBuilder';
import {
  getStoredStyleHint,
  setStoredStyleHint,
} from '@/ai/prompts';
import {
  DeepSeekError,
  callDeepSeek,
  generateSummary,
  getApiKey,
  hasApiKey,
  streamDeepSeek,
} from '@/ai/deepseek';

// =============================================================================
// 状态机定义
// =============================================================================

const STATUS_FLOW: ChapterStatus[] = ['outline', 'expanded', 'edited', 'final'];

function canAdvance(from: ChapterStatus, to: ChapterStatus): boolean {
  const fromIdx = STATUS_FLOW.indexOf(from);
  const toIdx = STATUS_FLOW.indexOf(to);
  return toIdx > fromIdx;
}

// =============================================================================
// 主页面
// =============================================================================

export default function Chapters() {
  const { bookId: bookIdRaw } = useParams<{ bookId: string }>();
  const bookId = Number(bookIdRaw);
  const validBookId = Number.isFinite(bookId) && bookId > 0;

  const chapters = useLiveQuery(
    () =>
      validBookId
        ? db.chapters.where('bookId').equals(bookId).sortBy('chapterNumber')
        : Promise.resolve([] as Chapter[]),
    [bookId, validBookId],
  );

  const book = useLiveQuery(
    async () => (validBookId ? await db.books.get(bookId) : undefined),
    [bookId, validBookId],
  );

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  // 默认选中第一个章节
  useEffect(() => {
    if (!chapters || chapters.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId == null || !chapters.some((c) => c.id === selectedId)) {
      setSelectedId(chapters[0].id ?? null);
    }
  }, [chapters, selectedId]);

  const selected = useMemo(
    () => chapters?.find((c) => c.id === selectedId) ?? null,
    [chapters, selectedId],
  );

  if (!validBookId) {
    return (
      <div className="text-sm text-2">
        无效的书籍 ID。
        <Link to="/" className="text-text underline ml-2">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:gap-3 h-full flex-1 min-h-0 min-h-[640px]">
      {/* 页头 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-baseline justify-between gap-3">
        <div>
          <div className="text-xs tnum text-3">CHAPTERS · {book?.name ?? `BOOK #${bookId}`}</div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold mt-1">章节创作</h1>
          <p className="text-xs sm:text-sm text-2 mt-1 hidden sm:block">
            创作流程：构思大纲 → 扩展内容 → 精细编辑 → 最终定稿（定稿后锁定，不可修改）
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={!chapters}
          className="w-full sm:w-auto"
        >
          <Plus className="w-3 h-3" strokeWidth={1.5} /> 新建章节
        </Button>
      </div>

      {/* 响应式布局：移动端堆叠（可折叠列表），桌面端双栏 */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col sm:flex-row border-2 border-text bg-bg shadow-[0_5px_0_0_#000]">
        {/* 章节列表 - 移动端可折叠，桌面端固定宽度 */}
        <div className="sm:w-[260px] shrink-0 sm:h-full border-r border-border overflow-hidden">
          {/* 移动端折叠按钮 */}
          <button
            className="sm:hidden flex items-center justify-between w-full px-3 py-2 border-b border-border bg-bg"
            onClick={() => setMobileListOpen(!mobileListOpen)}
          >
            <span className="text-xs tnum text-2">
              {mobileListOpen ? '收起列表' : `章节 · ${chapters?.length ?? 0}（点击展开）`}
            </span>
            <ChevronRight className={`w-4 h-4 transition-transform ${mobileListOpen ? 'rotate-90' : ''}`} strokeWidth={1.5} />
          </button>
          {/* 章节列表内容 */}
          <div className={`${mobileListOpen ? 'block' : 'hidden'} sm:block`}>
            <ChapterList
              chapters={chapters ?? []}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setMobileListOpen(false);
              }}
            />
          </div>
        </div>
        {/* 章节详情 */}
        <div className="flex-1 min-w-0">
          <ChapterDetail key={selected?.id ?? 'empty'} chapter={selected} bookId={bookId} />
        </div>
      </div>

      <CreateChapterDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        bookId={bookId}
        existingCount={chapters?.length ?? 0}
        onCreated={(id) => setSelectedId(id)}
      />
    </div>
  );
}

// =============================================================================
// 左侧：章节列表
// =============================================================================

function ChapterList({
  chapters,
  selectedId,
  onSelect,
}: {
  chapters: Chapter[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <aside className="border-r border-border flex flex-col min-h-0 max-h-[300px] sm:max-h-none">
      <div className="hidden sm:flex px-2 sm:px-3 py-2 sm:py-3 border-b border-border items-center justify-between">
        <span className="text-xs tnum text-2">章节 · {chapters.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {chapters.length === 0 ? (
          <div className="px-3 sm:px-4 py-8 sm:py-12 text-center text-xs text-3">
            还没有章节
            <br />
            <span className="hidden sm:inline">点击右上「新建章节」开始</span>
          </div>
        ) : (
          chapters.map((c) => (
            <ChapterListItem
              key={c.id}
              chapter={c}
              active={c.id === selectedId}
              onClick={() => c.id != null && onSelect(c.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function ChapterListItem({
  chapter,
  active,
  onClick,
}: {
  chapter: Chapter;
  active: boolean;
  onClick: () => void;
}) {
  const wc = useMemo(() => wordCount(chapter.content || ''), [chapter.content]);
  return (
    <div
      onClick={onClick}
      className={cn(
        'px-3 py-2.5 border-b-2 border-text cursor-pointer transition-all',
        active ? 'bg-surface text-text shadow-[inset_3px_0_0_0_#000]' : 'hover:bg-surface',
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'font-mono text-xs tnum',
            active ? 'text-text opacity-70' : 'text-3',
          )}
        >
          CH.{String(chapter.chapterNumber).padStart(3, '0')}
        </span>
        <StatusBadge status={chapter.status} />
      </div>
      <div className={cn('text-sm font-medium truncate', !active && 'text-text')}>
        {chapter.title || <span className="text-3">未命名章节</span>}
      </div>
      <div
        className={cn(
          'font-mono text-xs tnum mt-0.5',
          active ? 'text-bg opacity-70' : 'text-2',
        )}
      >
        {wc.toLocaleString()} 字 · {formatDateTime(chapter.updatedAt)}
      </div>
    </div>
  );
}

// =============================================================================
// 右侧：章节详情
// =============================================================================

function ChapterDetail({ chapter, bookId }: { chapter: Chapter | null; bookId: number }) {
  const [tab, setTab] = useState<'outline' | 'content'>('content');

  if (!chapter) {
    return (
      <section className="flex flex-col items-center justify-center text-2 text-sm">
        <Feather className="w-10 h-10 text-3 mb-3" strokeWidth={1.5} />
        <div>从左侧选择一个章节，或新建章节开始创作。</div>
      </section>
    );
  }

  return (
    <section className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
      {/* 顶部信息 */}
      <div className="shrink-0">
        <ChapterHeader chapter={chapter} bookId={bookId} />
      </div>

      {/* 状态机条 */}
      <div className="shrink-0">
        <StateMachineBar chapter={chapter} />
      </div>

      {/* Tab 切换 */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'outline' | 'content')}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        <div className="shrink-0 border-b border-border px-3 sm:px-6">
          <TabsList>
            <TabsTrigger value="content" className="text-xs sm:text-sm">正文</TabsTrigger>
            <TabsTrigger value="outline" className="text-xs sm:text-sm">设置</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="content" className="flex-1 min-h-0 overflow-hidden mt-0 px-3 sm:px-6 py-2 sm:py-4 flex flex-col">
          <ContentPane chapter={chapter} />
        </TabsContent>

        <TabsContent value="outline" className="flex-1 min-h-0 overflow-auto mt-0 px-3 sm:px-6 py-4 sm:py-8">
          <OutlinePane chapter={chapter} bookId={bookId} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

// =============================================================================
// 章节头部
// =============================================================================

function ChapterHeader({ chapter, bookId }: { chapter: Chapter; bookId: number }) {
  return (
    <div className="px-3 sm:px-6 py-1.5 sm:py-2 border-b border-border flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-2 tnum flex-wrap">
          <Link to={`/book/${bookId}`} className="hover:text-text">
            BOOK #{bookId}
          </Link>
          <ChevronRight className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-3" strokeWidth={1.5} />
          <span>CH.{String(chapter.chapterNumber).padStart(3, '0')}</span>
          <StatusBadge status={chapter.status} />
        </div>
        <h2 className="text-sm sm:text-md font-semibold mt-0.5 truncate">
          {chapter.title || '未命名章节'}
        </h2>
      </div>
      <div className="flex items-center gap-2 text-xs text-3 tnum shrink-0 hidden sm:block">
        <span>更新 {formatDateTime(chapter.updatedAt)}</span>
      </div>
    </div>
  );
}

// =============================================================================
// 状态机条
// =============================================================================

function StateMachineBar({ chapter }: { chapter: Chapter }) {
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const isFinal = chapter.status === 'final';
  const canEdit = !isFinal || unlocked;

  const setStatus = useCallback(
    async (next: ChapterStatus) => {
      if (chapter.id == null) return;
      await db.chapters.update(chapter.id, {
        status: next,
        updatedAt: new Date(),
      });
    },
    [chapter.id],
  );

  const advance = useCallback(async () => {
    const idx = STATUS_FLOW.indexOf(chapter.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    if (chapter.status === 'final') return;
    if (STATUS_FLOW[idx + 1] === 'final') {
      // 走二次确认
      setConfirmFinal(true);
      return;
    }
    await setStatus(STATUS_FLOW[idx + 1]);
  }, [chapter.status, setStatus]);

  const rollback = useCallback(async () => {
    const idx = STATUS_FLOW.indexOf(chapter.status);
    if (idx <= 0) return;
    await setStatus(STATUS_FLOW[idx - 1]);
  }, [chapter.status, setStatus]);

  return (
    <>
      <div className="px-3 sm:px-6 py-1.5 sm:py-2 bg-surface border-b border-border flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="hidden sm:inline text-xs tnum text-2 mr-1">创作流程</span>
          <span className="sm:hidden text-xs tnum text-2 mr-1">流程</span>
          {STATUS_FLOW.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5 sm:gap-2">
              <StatusBadge status={s} />
              {i < STATUS_FLOW.length - 1 && (
                <ArrowRight className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-3" strokeWidth={1.5} />
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {chapter.status !== 'outline' && chapter.status !== 'final' && (
            <Button size="sm" variant="ghost" onClick={rollback}>
              <ArrowRight className="w-3 h-3 rotate-180" strokeWidth={1.5} /> 返回上一阶段
            </Button>
          )}
          {chapter.status !== 'final' && (
            <Button
              size="sm"
              variant={chapter.status === 'edited' ? 'primary' : 'default'}
              onClick={advance}
              title={
                chapter.status === 'outline'
                  ? '这里仅更新创作进度，不会自动写正文；AI 扩写请到正文页手动触发'
                  : undefined
              }
            >
              <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
              <span className="hidden sm:inline">
                {chapter.status === 'outline' && '大纲就绪 · 进入正文创作'}
                {chapter.status === 'expanded' && '正文完成 · 进入精修'}
                {chapter.status === 'edited' && '精修完成 · 确认定稿'}
              </span>
              <span className="sm:hidden">
                {chapter.status === 'outline' && '进入正文'}
                {chapter.status === 'expanded' && '进入精修'}
                {chapter.status === 'edited' && '确认定稿'}
              </span>
            </Button>
          )}
          {isFinal && (
            <FinalStateToggle
              locked={!unlocked}
              onToggle={() => {
                if (unlocked) {
                  setUnlocked(false);
                } else {
                  setConfirmUnlock(true);
                }
              }}
            />
          )}
        </div>
      </div>

      {/* final 状态：底部只读提示条 */}
      {isFinal && !unlocked && (
        <div className="px-3 sm:px-6 py-1.5 bg-bg border-b border-border text-xs text-2">
          章节已定稿，处于只读状态。点击「解锁编辑」并二次确认后可继续修改。
        </div>
      )}

      {/* 定稿二次确认 */}
      <Dialog open={confirmFinal} onOpenChange={setConfirmFinal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认定稿？</DialogTitle>
            <DialogDescription>
              定稿后章节将变为只读。需要再次编辑时需手动解锁。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="text-sm leading-relaxed">
              章节「{chapter.title || '未命名'}」一旦定稿：
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>正文将锁定，无法直接编辑</li>
                <li>状态徽章变为 final（黑底白字）</li>
                <li>可作为前文摘要喂给后续章节的 AI 扩写</li>
              </ul>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmFinal(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                await setStatus('final');
                setConfirmFinal(false);
              }}
            >
              <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} /> 确认定稿
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 解锁二次确认 */}
      <Dialog open={confirmUnlock} onOpenChange={setConfirmUnlock}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>解锁已定稿章节？</DialogTitle>
            <DialogDescription>
              解锁后状态机会回退到上一态（edited），可继续修改。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="text-sm leading-relaxed">
              解锁不会丢失内容。建议在重新编辑完成后再次确认定稿。
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmUnlock(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                await setStatus('edited');
                setUnlocked(true);
                setConfirmUnlock(false);
              }}
            >
              解锁并回退到 edited
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================================================
// 正文 Pane（含 AI 扩写 + TipTap）
// =============================================================================

function ContentPane({ chapter }: { chapter: Chapter }) {
  const [isFinal, setIsFinal] = useState(chapter.status === 'final');
  const [unlocked, setUnlocked] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setIsFinal(chapter.status === 'final');
    setUnlocked(false);
    setError(null);
    setStreaming(false);
  }, [chapter.id, chapter.status]);

  const readOnly = isFinal && !unlocked;

  // 自动保存（debounce 由 TipTap 内部处理，这里再写一次到 DB）
  const handleAutosave = useCallback(
    async (html: string) => {
      if (chapter.id == null) return;
      try {
        await db.chapters.update(chapter.id, {
          content: html,
          updatedAt: new Date(),
        });
      } catch (e) {
        console.error('Autosave failed', e);
      }
    },
    [chapter.id],
  );

  // AI 扩写（流式）
  const handleExpand = useCallback(async () => {
    if (chapter.id == null) return;

    if (!hasApiKey()) {
      setError('尚未配置 DeepSeek API Key，请前往「设置」页面录入。');
      return;
    }

    setError(null);
    setStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const ctx = await buildContext(chapter.bookId, chapter.chapterNumber, {
        chapterId: chapter.id,
      });

      let acc = '';
      const { content } = await streamDeepSeek(
        { context: ctx, signal: ac.signal },
        {
          onDelta: (delta) => {
            acc += delta;
          },
        },
      );

      // 写回 chapters.content + status=expanded
      await db.chapters.update(chapter.id, {
        content: content || acc,
        status: 'expanded',
        updatedAt: new Date(),
      });

      // 自动生成 summary（不阻塞 UI）
      generateSummary(content || acc)
        .then(async (sum) => {
          if (sum && chapter.id != null) {
            await db.chapters.update(chapter.id, { summary: sum });
          }
        })
        .catch((e) => {
          console.warn('generateSummary failed', e);
        });
    } catch (e) {
      const err = e as DeepSeekError | Error;
      if (err && (err as DeepSeekError).kind === 'aborted') {
        // 主动取消，不报错
        return;
      }
      const msg = err instanceof DeepSeekError ? err.message : (err as Error)?.message ?? String(err);
      setError(msg);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [chapter.id, chapter.bookId, chapter.chapterNumber]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // 重新生成（不流式，直接覆盖）
  const handleRegenerate = useCallback(async () => {
    if (chapter.id == null) return;
    if (!hasApiKey()) {
      setError('尚未配置 DeepSeek API Key，请前往「设置」页面录入。');
      return;
    }
    setError(null);
    setStreaming(true);
    try {
      const ctx = await buildContext(chapter.bookId, chapter.chapterNumber, {
        chapterId: chapter.id,
      });
      const { content } = await callDeepSeek({ context: ctx });
      await db.chapters.update(chapter.id, {
        content,
        status: 'expanded',
        updatedAt: new Date(),
      });
    } catch (e) {
      const err = e as DeepSeekError | Error;
      const msg = err instanceof DeepSeekError ? err.message : (err as Error)?.message ?? String(err);
      setError(msg);
    } finally {
      setStreaming(false);
    }
  }, [chapter.id, chapter.bookId, chapter.chapterNumber]);

  // 字数（独立计算，因为状态变化时需要更新）
  const stats = useMemo(() => computeWordCount(chapter.content || ''), [chapter.content]);

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col flex-1 min-h-0">
      {/* AI 操作条 */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3 pb-2 border-b border-border">
        <div className="text-xs tnum text-2 whitespace-nowrap overflow-hidden text-ellipsis order-2 sm:order-1">
          {stats.total.toLocaleString()} 字 · 中文 {stats.chinese} / 英文 {stats.english} · 阅读 ~{stats.readMinutes} 分钟
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap order-1 sm:order-2">
          {!hasApiKey() && (
            <Link to="/settings" className="text-xs text-2 underline hover:text-text inline-flex items-center gap-1 whitespace-nowrap">
              <Settings className="w-3 h-3 shrink-0" strokeWidth={1.5} /> 配置 API Key
            </Link>
          )}
          {streaming ? (
            <Button size="sm" variant="destructive" onClick={handleCancel}>
              <Square className="w-3 h-3" strokeWidth={1.5} /> 取消
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={handleExpand}>
                <Sparkles className="w-3 h-3" strokeWidth={1.5} /> AI 扩写
              </Button>
              {chapter.content && (
                <Button size="sm" variant="ghost" onClick={handleRegenerate}>
                  <RefreshCcw className="w-3 h-3" strokeWidth={1.5} /> 重新生成
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 border border-text text-xs leading-relaxed bg-surface">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold mb-1">AI 调用失败</div>
              <div className="text-2">{error}</div>
            </div>
            <button onClick={() => setError(null)} className="text-3 hover:text-text">
              <XCircle className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      <ChapterEditor
        initialContent={chapter.content || ''}
        readOnly={readOnly}
        onAutosave={handleAutosave}
        placeholder="点击上方「AI 扩写」自动生成，或直接在此撰写正文……"
      />
    </div>
  );
}

// =============================================================================
// 大纲 Pane：标题 / 编号 / 大纲 / 关联人物 / 关联地点 / 事件描述 / 风格选择
// =============================================================================

function OutlinePane({ chapter, bookId }: { chapter: Chapter; bookId: number }) {
  const [charIds, setCharIds] = useState<number[]>(chapter.characterIds || []);
  const [nodeIds, setNodeIds] = useState<number[]>(chapter.graphNodeIds || []);
  const [styleHint, setStyleHint] = useState(getStoredStyleHint());
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Chapter | null>(null);

  // 章节切换时重置
  useEffect(() => {
    setCharIds(chapter.characterIds || []);
    setNodeIds(chapter.graphNodeIds || []);
    setSavedHint(null);
  }, [chapter.id, chapter.characterIds, chapter.graphNodeIds]);

  const characters = useLiveQuery(
    () => db.characters.where('bookId').equals(bookId).toArray(),
    [bookId],
  );
  const graphNodes = useLiveQuery(
    () => db.graph_nodes.where('bookId').equals(bookId).toArray(),
    [bookId],
  );

  const charNameMap = useMemo(() => {
    const m = new Map<number, Character>();
    (characters ?? []).forEach((c) => c.id != null && m.set(c.id, c));
    return m;
  }, [characters]);

  const nodeNameMap = useMemo(() => {
    const m = new Map<number, GraphNode>();
    (graphNodes ?? []).forEach((n) => n.id != null && m.set(n.id, n));
    return m;
  }, [graphNodes]);

  const dirty =
    JSON.stringify(charIds) !== JSON.stringify(chapter.characterIds || []) ||
    JSON.stringify(nodeIds) !== JSON.stringify(chapter.graphNodeIds || []);

  const handleSave = useCallback(async () => {
    if (chapter.id == null) return;
    await db.chapters.update(chapter.id, {
      characterIds: charIds,
      graphNodeIds: nodeIds,
      updatedAt: new Date(),
    });
    setStoredStyleHint(styleHint);
    setSavedHint('已保存 ' + formatDateTime(new Date()));
    setTimeout(() => setSavedHint(null), 3000);
  }, [chapter.id, charIds, nodeIds, styleHint]);

  const toggleArrayId = (arr: number[], id: number): number[] =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Label>关联人物</Label>
        <div className="flex flex-wrap gap-2 p-3 border-2 border-text bg-bg min-h-[48px]">
          {(characters ?? []).length === 0 && (
            <span className="text-xs text-3">暂无人物</span>
          )}
          {(characters ?? []).map((c) => {
            const active = charIds.includes(c.id!);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCharIds(toggleArrayId(charIds, c.id!))}
                className={cn(
                  'inline-flex items-center gap-1 px-2 h-7 text-xs border-2 font-semibold transition-all select-none',
                  active
                    ? 'bg-bg text-text border-text shadow-[0_2px_0_0_#000] -translate-y-0.5'
                    : 'bg-bg text-text border-border shadow-[0_2px_0_0_#E5E5E5] hover:border-text hover:-translate-y-0.5 hover:shadow-[0_3px_0_0_#E5E5E5] active:translate-y-[1px] active:shadow-[0_1px_0_0_#E5E5E5]',
                )}
              >
                <CategoryShape category={c.category} />
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>关联节点（人物 / 势力 / 地域 / 宗门）</Label>
        <div className="flex flex-wrap gap-2 p-3 border-2 border-text bg-bg min-h-[48px]">
          {(graphNodes ?? []).length === 0 && (
            <span className="text-xs text-3">暂无可关联节点 — 去「关系网」创建</span>
          )}
          {(graphNodes ?? []).map((n) => {
            const active = nodeIds.includes(n.id!);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setNodeIds(toggleArrayId(nodeIds, n.id!))}
                className={cn(
                  'inline-flex items-center gap-1 px-2 h-7 text-xs border-2 font-semibold transition-all select-none',
                  active
                    ? 'bg-bg text-text border-text shadow-[0_2px_0_0_#000] -translate-y-0.5'
                    : 'bg-bg text-text border-border shadow-[0_2px_0_0_#E5E5E5] hover:border-text hover:-translate-y-0.5 hover:shadow-[0_3px_0_0_#E5E5E5] active:translate-y-[1px] active:shadow-[0_1px_0_0_#E5E5E5]',
                )}
              >
                {n.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>扩写风格提示</Label>
        <Input
          value={styleHint}
          onChange={(e) => setStyleHint(e.target.value)}
          placeholder="古风玄幻、诙谐幽默、严肃文学、轻松搞笑..."
          className="max-w-md"
        />
        <div className="text-xs text-3 mt-2">
          提示：输入风格关键词，AI 将据此调整文风。示例：古风玄幻、仙侠修真、江湖恩怨、悬疑推理
        </div>
      </div>

      {/* 已选预览 */}
      <div className="border-2 border-text p-4 bg-surface shadow-[0_4px_0_0_#000]">
        <div className="text-xs tnum text-2 mb-2">已选预览</div>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-2 mr-2">人物：</span>
            {charIds.length === 0 && <span className="text-3">（无）</span>}
            {charIds.map((id) => (
              <span key={id} className="inline-block mr-3 text-text">
                {charNameMap.get(id)?.name ?? `#${id}`}
              </span>
            ))}
          </div>
          <div>
            <span className="text-2 mr-2">关联节点：</span>
            {nodeIds.length === 0 && <span className="text-3">（无）</span>}
            {nodeIds.map((id) => (
              <span key={id} className="inline-block mr-3 text-text">
                {nodeNameMap.get(id)?.name ?? `#${id}`}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 操作 */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="text-xs text-2">
          {savedHint ?? (dirty ? '有未保存的修改' : '所有更改已保存')}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleSave} disabled={!dirty}>
            <Save className="w-3 h-3" strokeWidth={1.5} /> 保存设置
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(chapter)}>
            <Trash2 className="w-3 h-3" strokeWidth={1.5} /> 删除章节
          </Button>
        </div>
      </div>

      {/* 删除章节确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title="删除章节"
        description={`确认删除章节「${deleteConfirm?.title || deleteConfirm?.chapterNumber || ''}」？该操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        confirmVariant="destructive"
        onConfirm={async () => {
          await executeDeleteChapter(deleteConfirm);
          setDeleteConfirm(null);
        }}
      />
    </div>
  );
}

// =============================================================================
// 分类小图标（极简风）
// =============================================================================

function CategoryShape({ category }: { category: Character['category'] }) {
  switch (category) {
    case 'protagonist':
      return <span className="inline-block w-2 h-2 rounded-full bg-current" />;
    case 'supporting':
      return <span className="inline-block w-2 h-2 bg-current" />;
    case 'villain':
      return (
        <span
          className="inline-block"
          style={{
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderBottom: '6px solid currentColor',
          }}
        />
      );
    case 'npc':
      return (
        <span
          className="inline-block w-2 h-2 border border-current"
          style={{ transform: 'rotate(45deg)' }}
        />
      );
    default:
      return null;
  }
}

// =============================================================================
// 删除章节
// =============================================================================

async function executeDeleteChapter(chapter: Chapter | null) {
  if (chapter?.id == null) return;
  await db.chapters.delete(chapter.id);
}

// =============================================================================
// 新建章节对话框
// =============================================================================

function CreateChapterDialog({
  open,
  onOpenChange,
  bookId,
  existingCount,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: number;
  existingCount: number;
  onCreated: (id: number) => void;
}) {
  const [title, setTitle] = useState('');
  const [number, setNumber] = useState(existingCount + 1);
  const [outline, setOutline] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setNumber(existingCount + 1);
      setOutline('');
    }
  }, [open, existingCount]);

  const handleCreate = useCallback(async () => {
    const now = new Date();
    const id = await db.chapters.add({
      bookId,
      title: title.trim() || `第 ${number} 章`,
      chapterNumber: Math.max(1, number),
      outline: outline.trim(),
      content: '',
      summary: '',
      characterIds: [],
      graphNodeIds: [],
      eventDescription: '',
      status: 'outline',
      createdAt: now,
      updatedAt: now,
    });
    onCreated(id as number);
    onOpenChange(false);
  }, [bookId, title, number, outline, onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建章节</DialogTitle>
          <DialogDescription>
            新章节默认进入「构思大纲」阶段。填写大纲后，切到「正文」页手动点「AI 扩写」才会生成正文（不会自动触发）。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <Label htmlFor="new-title">章节标题</Label>
            <Input
              id="new-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：东海之约"
            />
          </div>
          <div>
            <Label htmlFor="new-num">章节编号</Label>
            <Input
              id="new-num"
              type="number"
              min={1}
              value={number}
              onChange={(e) =>
                setNumber(Math.max(1, parseInt(e.target.value || '1', 10)))
              }
            />
          </div>
          <div>
            <Label htmlFor="new-outline">章节大纲（可选）</Label>
            <Textarea
              id="new-outline"
              rows={5}
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              placeholder="用条目列出本章节情……"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreate}>
            <Plus className="w-3 h-3" strokeWidth={1.5} /> 创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// 导出一些工具（便于测试 / 重用）
// =============================================================================

export { STATUS_FLOW, canAdvance };