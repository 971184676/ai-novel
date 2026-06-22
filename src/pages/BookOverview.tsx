// =============================================================================
// novel-creator · 书籍总览
// 路径 /book/:bookId
//   - 顶部：书籍信息卡（名称、类型、状态、创建/更新时间）
//   - Level 进度（7 段线段填充）
//   - 模块状态卡片网格（9 个）
//   - 最近章节列表
//   - 数据统计 / 最近活动 / 存储
//   - 导出 / 导入 按钮
// =============================================================================

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertOctagon,
  ArrowLeft,
  CheckCircle2,
  Database,
  Download,
  Edit3,
  Feather,
  FileText,
  Flag,
  GitFork,
  Globe,
  Layers,
  Lock,
  Play,
  Share2,
  Sword,
  Upload,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { db } from '@/db/database';
import type { Book, Chapter } from '@/db/types';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
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
import {
  applyImport,
  BACKUP_WARN_SIZE_BYTES,
  deleteBookCascade,
  estimateDbSize,
  exportBook,
  summarizeBackup,
  validateBackup,
  type BackupBundle,
  type BackupSummary,
} from '@/db/exportImport';
import { exportNovel } from '@/db/exportNovel';
import { useGameProgress, type LevelProgress } from '@/hooks/useGameProgress';
import { useToaster } from '@/hooks/useToaster';
import { cn, formatDate, formatDateTime, formatBigNumber } from '@/lib/utils';

// =============================================================================
// 主页面
// =============================================================================

export default function BookOverview() {
  const { bookId: raw } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const toaster = useToaster();
  const bookId = Number(raw);
  const valid = Number.isFinite(bookId) && bookId > 0;

  const book = useLiveQuery(
    async () => (valid ? await db.books.get(bookId) : undefined),
    [bookId, valid],
  );
  const progress = useGameProgress(valid ? bookId : null);
  const recentChapters = useLiveQuery(
    async () => {
      if (!valid) return [] as Chapter[];
      const arr = await db.chapters.where('bookId').equals(bookId).toArray();
      return arr.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 6);
    },
    [bookId, valid],
  );
  const totalChapters = useLiveQuery(
    () => (valid ? db.chapters.where('bookId').equals(bookId).count() : Promise.resolve(0)),
    [bookId, valid],
  );
  const totalWords = progress?.counts.totalWords ?? 0;
  const completedCount = progress?.completedCount ?? 0;
  const percent = progress?.percent ?? 0;

  const [editing, setEditing] = React.useState(false);
  const [storageUsed, setStorageUsed] = React.useState(0);

  React.useEffect(() => {
    if (valid) {
      estimateDbSize().then((s) => setStorageUsed(s));
    }
  }, [valid, totalChapters]);

  if (!valid) {
    return (
      <div className="text-sm text-2">
        无效的书籍 ID。
        <Link to="/" className="text-text underline ml-2">
          返回首页
        </Link>
      </div>
    );
  }

  if (book === undefined || progress === undefined) {
    return <div className="text-sm text-3">加载中…</div>;
  }

  if (book === null || book === undefined) {
    return (
      <div className="text-sm">
        <div className="text-md font-semibold mb-2">书籍不存在</div>
        <div className="text-2 mb-4">该书籍可能已被删除。</div>
        <Link to="/">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="w-3 h-3" strokeWidth={1.5} /> 返回首页
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* 顶部操作条 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs tnum text-3">
          OVERVIEW · 书籍 #{String(bookId).padStart(3, '0')}
        </div>
        <div className="flex items-center gap-2">
          <ExportNovelButton bookId={bookId} bookName={book.name} />
          <ExportBookButton bookId={bookId} bookName={book.name} />
          <ImportButton bookId={bookId} onSuccess={() => toaster.success('导入完成')} />
          <Link to={`/book/${bookId}/chapters`}>
            <Button size="sm" variant="ghost">
              <Play className="w-3 h-3" strokeWidth={1.5} /> 继续创作
            </Button>
          </Link>
        </div>
      </div>

      {/* Header */}
      <BookHeader
        book={book}
        onEdit={() => setEditing(true)}
      />

      {/* Level Track */}
      <LevelTrack
        levels={progress.levels}
        percent={percent}
        completedCount={completedCount}
        bookId={bookId}
      />

      {/* 2-col: 模块状态 + 数据/活动 */}
      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-8 space-y-10">
          <ModuleGrid bookId={bookId} progress={progress} />
          <RecentChapters bookId={bookId} chapters={recentChapters ?? []} />
        </section>
        <aside className="col-span-4 space-y-8">
          <StatsPanel
            wordCount={totalWords}
            chapterCount={totalChapters ?? 0}
            counts={progress.counts}
          />
          <DangerPanel
            bookId={bookId}
            bookName={book.name}
            onDeleted={() => navigate('/')}
          />
          <StoragePanel used={storageUsed} />
        </aside>
      </div>

      {/* 编辑元数据 */}
      <EditBookDialog
        open={editing}
        onOpenChange={setEditing}
        book={book}
        onSaved={() => {
          setEditing(false);
          toaster.success('已保存');
        }}
      />
    </div>
  );
}

// =============================================================================
// Header
// =============================================================================

function BookHeader({ book, onEdit }: { book: Book; onEdit: () => void }) {
  return (
    <header className="flex items-start justify-between gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="text-xs tnum text-3 mb-2">OVERVIEW · 书籍总览</div>
        <h1 className="text-2xl font-semibold leading-tight">{book.name}</h1>
        {book.description && (
          <p className="text-sm text-2 mt-2 max-w-xl leading-relaxed">{book.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3 text-xs text-2 tnum flex-wrap">
          <span className="border-2 border-text px-2 py-0.5 bg-bg text-text font-medium">{book.genre}</span>
          <span
            className={cn(
              'inline-flex items-center h-5 px-2 border-2 font-semibold text-xs',
              book.status === 'completed'
                ? 'bg-bg text-text border-text shadow-[0_2px_0_0_#000]'
                : 'bg-bg text-text border-text',
            )}
          >
            {book.status === 'completed' ? '已完结' : '进行中'}
          </span>
          <span className="text-3">
            创建 {formatDate(book.createdAt)} · 更新 {formatDateTime(book.updatedAt)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Edit3 className="w-3 h-3" strokeWidth={1.5} /> 编辑信息
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href).catch(() => {});
          }}
          title="复制当前页面链接（数据在本地，不会真分享）"
        >
          <Share2 className="w-3 h-3" strokeWidth={1.5} /> 分享
        </Button>
      </div>
    </header>
  );
}

// =============================================================================
// Level Track（核心视觉：7 段线段填充）
// =============================================================================

function LevelTrack({
  levels,
  percent,
  completedCount,
  bookId,
}: {
  levels: LevelProgress[];
  percent: number;
  completedCount: number;
  bookId: number;
}) {
  const current = levels.find((l) => l.currentLevel);
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-md font-semibold">
          Level 进度{' '}
          <span className="text-3 text-xs tnum ml-2 font-normal">
            {completedCount} / {levels.length}
            {current && ` · 当前 ${current.name}`}
          </span>
        </h2>
        <div className="text-xs text-2 tnum">总进度 {percent}%</div>
      </div>

      <div className="border-2 border-text grid grid-cols-6 shadow-[0_5px_0_0_#000]">
        {levels.map((l) => {
          const targetLink = levelToRoute(l.level);
          return (
            <Link
              key={l.level}
              to={`/book/${bookId}/${targetLink}`}
              className={cn(
                'border-r-2 border-text last:border-r-0 px-3 py-4 bg-bg text-text',
                'transform translate-y-0 transition-all duration-150',
                'hover:-translate-y-1 hover:shadow-[0_5px_0_0_#000]',
              )}
              title={`${l.name} · ${l.description}`}
            >
              <LevelCell level={l} />
            </Link>
          );
        })}
      </div>

      {current && (
        <div className="flex items-center justify-between mt-3 text-xs text-2">
          <span>
            下一个：{current.name} · <span className="text-3">{current.description}</span>
          </span>
          <span className="tnum">
            {current.current} / {current.target}
          </span>
        </div>
      )}
    </section>
  );
}

function LevelCell({ level }: { level: LevelProgress }) {
  const { level: n, name, description, current, completed } = level;
  const isCurrent = level.currentLevel;
  const isCompleted = completed && !isCurrent;
  return (
    <>
      {/* 当前关卡的小箭头指示器（所有 cell 都有这个槽位，避免高度跳动） */}
      <div className="h-3 mb-1 flex items-end justify-center">
        {isCurrent && (
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-text" />
        )}
      </div>
      {/* 编号徽章：所有 cell 一致样式（白底黑边 + 硬阴影） */}
      <div className="w-7 h-7 inline-flex items-center justify-center text-xs font-semibold tnum border-2 border-text bg-bg text-text shadow-[0_2px_0_0_#000] mb-2">
        {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> : n}
      </div>
      {/* 标题 / 描述：所有 cell 一致黑色 */}
      <div className="text-xs font-semibold mb-0.5 text-text">{name}</div>
      <div className="text-xs mb-3 text-text-2 leading-snug">{description}</div>
      {/* 进度线：所有 cell 一样画，只是填充段数不同 */}
      <div className="text-xs tnum leading-none">
        <LevelLine completed={completed} current={current} target={level.target} />
      </div>
    </>
  );
}

function LevelLine({
  completed,
  current,
  target,
}: {
  completed: boolean;
  current: number;
  target: number;
}) {
  // 5 段进度条
  const segs = 5;
  const filled = completed ? segs : Math.min(segs, Math.max(0, Math.round((current / target) * segs)));
  const parts: string[] = [];
  for (let i = 0; i < segs; i++) {
    if (i < filled) parts.push('━━━');
    else parts.push('┄┄┄');
  }
  return <span className="tracking-tighter">{parts.join(' ')}</span>;
}

function levelToRoute(level: 1 | 2 | 3 | 4 | 5 | 6): string {
  // 注意：callers 实际传入的是相对路径前缀；这里拼到 /book/:bookId
  // 留作 helper，由调用方拼 bookId
  return LEVEL_ROUTES[level];
}

const LEVEL_ROUTES: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: 'world',
  2: 'characters',
  3: 'cultivation',
  4: 'factions',
  5: 'chapters',
  6: 'chapters',
};

// =============================================================================
// 模块状态网格
// =============================================================================

type Counts = NonNullable<ReturnType<typeof useGameProgress>>['counts'];

interface ModuleMeta {
  key: string;
  label: string;
  icon: LucideIcon;
  href: (bookId: number) => string;
  /** 该模块在哪个 Level 计分 */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  count: (counts: Counts) => number;
  /** 是否完成（count >= target） */
  done: (counts: Counts) => boolean;
  target: number;
}

const MODULES: ModuleMeta[] = [
  {
    key: 'world',
    label: '世界观',
    icon: Globe,
    href: (id) => `/book/${id}/world`,
    level: 1,
    target: 1,
    count: (c) => c.world,
    done: (c) => c.world >= 1,
  },
  {
    key: 'characters',
    label: '人物库',
    icon: Users,
    href: (id) => `/book/${id}/characters`,
    level: 2,
    target: 3,
    count: (c) => c.characters,
    done: (c) => c.characters >= 3,
  },
  {
    key: 'relationships',
    label: '人物关系',
    icon: GitFork,
    href: (id) => `/book/${id}/relationships`,
    level: 2,
    target: 0, // 非计分
    count: (c) => c.relationships,
    done: () => true,
  },
  {
    key: 'relationships-graph',
    label: '关系网',
    icon: GitFork,
    href: (id) => `/book/${id}/relationships`,
    level: 2, // 关卡 3「绘世」已移除，关系网卡片归到 L2 角色入库下
    target: 0,
    count: (c) => c.locations, // 关系网节点总数
    done: () => true,
  },
  {
    key: 'cultivation',
    label: '修行境界',
    icon: Layers,
    href: (id) => `/book/${id}/cultivation`,
    level: 3,
    target: 3,
    count: (c) => c.cultivationLevels,
    done: (c) => c.cultivationLevels >= 3,
  },
  {
    key: 'equipment',
    label: '装备',
    icon: Sword,
    href: (id) => `/book/${id}/equipment`,
    level: 3,
    target: 0,
    count: (c) => c.equipment,
    done: () => true,
  },
  {
    key: 'skills',
    label: '技能',
    icon: Zap,
    href: (id) => `/book/${id}/skills`,
    level: 3,
    target: 0,
    count: (c) => c.skills,
    done: () => true,
  },
  {
    key: 'factions',
    label: '阵营',
    icon: Flag,
    href: (id) => `/book/${id}/factions`,
    level: 4,
    target: 2,
    count: (c) => c.factions,
    done: (c) => c.factions >= 2,
  },
  {
    key: 'chapters',
    label: '章节',
    icon: Feather,
    href: (id) => `/book/${id}/chapters`,
    level: 5,
    target: 3,
    count: (c) => c.chapters,
    done: (c) => c.chapters >= 3,
  },
];

function ModuleGrid({
  bookId,
  progress,
}: {
  bookId: number;
  progress: NonNullable<ReturnType<typeof useGameProgress>>;
}) {
  return (
    <section>
      <h2 className="text-md font-semibold mb-4">
        模块状态{' '}
        <span className="text-3 text-xs font-normal tnum ml-2">
          点击进入 · 共 {MODULES.length} 个
        </span>
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {MODULES.map((m) => {
          const n = m.count(progress.counts);
          const done = m.done(progress.counts);
          const locked = n === 0 && m.target > 0;
          return (
            <Link
              key={m.key}
              to={m.href(bookId)}
              className={cn(
                'card-3d p-4 flex flex-col gap-2',
                locked && 'opacity-50',
              )}
            >
              <div className="flex items-center justify-between">
                <m.icon className="w-4 h-4" strokeWidth={1.5} />
                {done ? (
                  <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
                ) : locked ? (
                  <Lock className="w-3 h-3 text-3" strokeWidth={1.5} />
                ) : (
                  <span className="text-xs tnum text-2">
                    {m.target > 0 ? `${n}/${m.target}` : n}
                  </span>
                )}
              </div>
              <div className="text-2xl font-semibold tnum leading-none">{n}</div>
              <div className="text-xs text-2">{m.label}</div>
              <div className="text-xs text-3 tnum mt-auto">
                {done ? '完成' : m.target > 0 ? `${n}/${m.target} · 进行中` : '已建立'}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// =============================================================================
// 最近章节
// =============================================================================

function RecentChapters({ bookId, chapters }: { bookId: number; chapters: Chapter[] }) {
  return (
    <section>
      <h2 className="text-md font-semibold mb-4">
        最近章节{' '}
        <Link
          to={`/book/${bookId}/chapters`}
          className="text-3 text-xs font-normal tnum ml-2 hover:text-text"
        >
          查看全部 →
        </Link>
      </h2>
      <div className="list-3d">
        {chapters.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-3">
            还没有章节 — <Link to={`/book/${bookId}/chapters`} className="text-text underline">前往新建</Link>
          </div>
        ) : (
          chapters.map((c, idx) => (
            <Link
              key={c.id}
              to={`/book/${bookId}/chapters`}
              className={cn(
                'list-row-3d flex items-center gap-3 px-4 py-3',
                idx < chapters.length - 1 && 'border-b-2 border-text',
              )}
            >
              <span className="w-1.5 h-1.5 bg-text shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  第 {String(c.chapterNumber).padStart(3, '0')} 章 · {c.title || '未命名'}
                </div>
                <div className="text-xs text-3 tnum">
                  {c.status} · {formatDateTime(c.updatedAt)}
                </div>
              </div>
              <StatusBadge status={c.status} />
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function StatsPanel({
  wordCount,
  chapterCount,
  counts,
}: {
  wordCount: number;
  chapterCount: number;
  counts: Counts;
}) {
  return (
    <section>
      <h2 className="text-md font-semibold mb-4">数据</h2>
      <div className="card-3d">
        <Stat label="字数" value={formatBigNumber(wordCount)} />
        <Stat label="章节" value={`${chapterCount}`} />
        <Stat label="人物" value={`${counts.characters}`} />
        <Stat label="关系" value={`${counts.relationships}`} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="text-xs text-3 tnum">{label}</div>
      <div className="text-xl font-semibold tnum leading-none">{value}</div>
    </div>
  );
}



// =============================================================================
// 危险区
// =============================================================================

function DangerPanel({
  bookId,
  bookName,
  onDeleted,
}: {
  bookId: number;
  bookName: string;
  onDeleted: () => void;
}) {
  const toaster = useToaster();
  const [confirming, setConfirming] = React.useState(false);
  const [text, setText] = React.useState('');

  const handleDelete = async () => {
    if (text.trim() !== bookName.trim()) {
      toaster.warning('书名不匹配');
      return;
    }
    try {
      await deleteBookCascade(bookId);
      toaster.success(`已删除「${bookName}」`);
      onDeleted();
    } catch (e) {
      toaster.error('删除失败', (e as Error).message);
    }
  };

  return (
    <section>
      <h2 className="text-md font-semibold mb-4 flex items-center gap-2">
        <AlertOctagon className="w-3.5 h-3.5" strokeWidth={1.5} /> 危险操作
      </h2>
      <div className="card-3d p-4 space-y-2">
        <div className="text-xs text-2 leading-relaxed">
          删除本书会一并删除全部人物、地图、境界、装备、技能、阵营、章节，不可撤销。
        </div>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
          删除本书
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除「{bookName}」？</DialogTitle>
            <DialogDescription>
              将删除全部关联数据。建议先在「设置」中导出 JSON 备份。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="text-sm leading-relaxed">
              请输入书籍名 <code className="font-mono bg-surface px-1">{bookName}</code> 以确认：
            </div>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={bookName}
              className="mt-3"
              autoFocus
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={text.trim() !== bookName.trim()}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// =============================================================================
// 存储面板
// =============================================================================

function StoragePanel({ used }: { used: number }) {
  const quotaMB = 200; // 假设 200MB 配额
  const usedMB = used / 1024 / 1024;
  const segs = 10;
  const filled = Math.min(segs, Math.max(0, Math.round((usedMB / quotaMB) * segs)));
  return (
    <section>
      <h2 className="text-md font-semibold mb-4">存储</h2>
      <div className="card-3d p-3">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-3 tnum">本地数据库</span>
          <span className="text-xs tnum">
            {usedMB.toFixed(1)} / {quotaMB} MB
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: segs }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-2 flex-1 border-2 border-text',
                i < filled ? 'bg-text' : 'bg-bg',
              )}
            />
          ))}
        </div>
        <div className="text-xs text-3 mt-2">建议定期导出 JSON 备份</div>
      </div>
    </section>
  );
}

// =============================================================================
// 编辑元数据
// =============================================================================

const GENRES = ['仙侠', '奇幻', '玄幻', '武侠', '科幻', '都市', '历史', '其他'] as const;

function EditBookDialog({
  open,
  onOpenChange,
  book,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  book: Book;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(book.name);
  const [genre, setGenre] = React.useState(book.genre);
  const [description, setDescription] = React.useState(book.description ?? '');
  const [status, setStatus] = React.useState<Book['status']>(book.status);
  const toaster = useToaster();

  React.useEffect(() => {
    setName(book.name);
    setGenre(book.genre);
    setDescription(book.description ?? '');
    setStatus(book.status);
  }, [book.id, book.name, book.genre, book.description, book.status]);

  const handleSave = async () => {
    if (book.id == null) return;
    try {
      await db.books.update(book.id, {
        name: name.trim() || book.name,
        genre,
        description: description.trim(),
        status,
        updatedAt: new Date(),
      });
      onSaved();
    } catch (e) {
      toaster.error('保存失败', (e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑书籍信息</DialogTitle>
          <DialogDescription>
            修改后立即生效。名称会显示在面包屑和首页卡片上。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <Label>书名</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <div>
            <Label>类型</Label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full h-9 px-3 text-sm border-2 border-text bg-bg text-text focus:shadow-[0_3px_0_0_#E5E5E5] focus:outline-none"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>简介</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2 text-sm border-2 border-text bg-bg text-text focus:shadow-[0_3px_0_0_#E5E5E5] focus:outline-none"
            />
          </div>
          <div>
            <Label>状态</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={status === 'ongoing' ? 'primary' : 'ghost'}
                onClick={() => setStatus('ongoing')}
              >
                进行中
              </Button>
              <Button
                size="sm"
                variant={status === 'completed' ? 'primary' : 'ghost'}
                onClick={() => setStatus('completed')}
              >
                已完结
              </Button>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// 导出 / 导入
// =============================================================================

function ExportNovelButton({ bookId, bookName }: { bookId: number; bookName: string }) {
  const toaster = useToaster();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await exportNovel(bookId);
          toaster.success(
            `已导出「${bookName}」为小说`,
            `${r.filename} · ${r.chaptersExported} 章 · ${(r.size / 1024).toFixed(1)} KB`,
          );
        } catch (e) {
          toaster.error('导出失败', (e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      title="把所有章节正文导出为 Word 文档（封面 + 目录 + 正文）"
    >
      <FileText className="w-3 h-3" strokeWidth={1.5} />
      {busy ? '导出中…' : '导出小说 DOCX'}
    </Button>
  );
}

function ExportBookButton({ bookId, bookName }: { bookId: number; bookName: string }) {
  const toaster = useToaster();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await exportBook(bookId);
          const sizeMB = (r.size / 1024 / 1024).toFixed(2);
          const warn = r.size > BACKUP_WARN_SIZE_BYTES ? '（文件较大）' : '';
          toaster.success(`已导出「${bookName}」备份`, `${r.filename} · ${sizeMB} MB ${warn}`.trim());
        } catch (e) {
          toaster.error('导出失败', (e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download className="w-3 h-3" strokeWidth={1.5} />
      {busy ? '导出中…' : '导出备份 JSON'}
    </Button>
  );
}

function ImportButton({ bookId, onSuccess }: { bookId: number; onSuccess: () => void }) {
  const toaster = useToaster();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dryRun, setDryRun] = React.useState<{
    bundle: BackupBundle;
    summary: BackupSummary;
  } | null>(null);
  const [applying, setApplying] = React.useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > BACKUP_WARN_SIZE_BYTES) {
      const ok = window.confirm(
        `文件大小 ${(file.size / 1024 / 1024).toFixed(1)}MB 超过 50MB，确认继续？`,
      );
      if (!ok) return;
    }
    try {
      const text = await file.text();
      const r = validateBackup(text);
      if (!r.ok) {
        toaster.error('备份文件校验失败', r.error);
        return;
      }
      setDryRun({ bundle: r.bundle, summary: summarizeBackup(r.bundle) });
    } catch (err) {
      toaster.error('读取文件失败', (err as Error).message);
    }
  };

  const handleApply = async () => {
    if (!dryRun) return;
    setApplying(true);
    try {
      const r = await applyImport(dryRun.bundle, 'overwrite');
      toaster.success('导入完成', `已写入 ${r.booksAffected} 本书 / ${r.chaptersAffected} 章节`);
      onSuccess();
      setDryRun(null);
    } catch (err) {
      toaster.error('导入失败', (err as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
        <Upload className="w-3 h-3" strokeWidth={1.5} /> 导入备份
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFile}
      />

      <Dialog open={!!dryRun} onOpenChange={(o) => !o && setDryRun(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认导入？</DialogTitle>
            <DialogDescription>
              导入将覆盖数据库中相同 ID 的书籍（#{bookId}）及其全部关联数据。建议先导出当前数据。
            </DialogDescription>
          </DialogHeader>
          {dryRun && (
            <DialogBody>
              <div className="text-xs text-2 tnum mb-3">
                导出时间 {formatDateTime(dryRun.summary.exportedAt)} · v{dryRun.summary.schemaVersion} ·{' '}
                {dryRun.summary.scope === 'all-data' ? '全量' : '单书'}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs tnum">
                <Mini label="书籍" value={dryRun.summary.booksCount} />
                <Mini label="人物" value={dryRun.summary.charactersCount} />
                <Mini label="关系" value={dryRun.summary.relationshipsCount} />
                <Mini label="关系网节点" value={dryRun.summary.graphNodesCount} />
                <Mini label="关系网连线" value={dryRun.summary.graphEdgesCount} />
                <Mini label="境界" value={dryRun.summary.cultivationLevelsCount} />
                <Mini label="装备" value={dryRun.summary.equipmentCount} />
                <Mini label="技能" value={dryRun.summary.skillsCount} />
                <Mini label="阵营" value={dryRun.summary.factionsCount} />
                <Mini label="世界观" value={dryRun.summary.worldSettingsCount} />
                <Mini label="章节" value={dryRun.summary.chaptersCount} highlight />
              </div>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDryRun(null)} disabled={applying}>
              取消
            </Button>
            <Button variant="primary" size="sm" onClick={handleApply} disabled={applying}>
              {applying ? '导入中…' : '确认覆盖'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Mini({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'border-2 border-text p-2 bg-bg text-text',
        highlight && 'shadow-[0_2px_0_0_#000]',
      )}
    >
      <div className="text-3">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

// =============================================================================
// Local helper
// =============================================================================

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium tracking-wider uppercase text-2 mb-2">{children}</div>
  );
}
