// =============================================================================
// ai-novel · 首页
// 赛博风布局 + 原版黑白配色
// =============================================================================

import * as React from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Settings,
  Trash2,
  ArrowUpDown,
  LayoutGrid,
  List,
  Database,
  Terminal,
  Cpu,
  ChevronRight,
  X,
  Clock,
  Globe,
  Users,
  Network,
  Sparkles,
  Shield,
  FileText,
} from 'lucide-react';
import { db } from '@/db/database';
import type { Book } from '@/db/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToaster } from '@/hooks/useToaster';
import { deleteBookCascade, estimateDbSize } from '@/db/exportImport';
import { LEVELS, useGameProgressSimple } from '@/hooks/useGameProgress';
import { cn, formatDate, formatBytes } from '@/lib/utils';

// 黑白配色 tokens
const FONT_MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace";

// =============================================================================
// 顶层 Home
// =============================================================================

type FilterTab = 'all' | 'ongoing' | 'completed';
type SortMode = 'updated' | 'created' | 'name';
type ViewMode = 'grid' | 'list';

export default function Home() {
  const toaster = useToaster();

  const books = useLiveQuery(() => db.books.toArray(), []) ?? [];
  const chaptersByBook = useLiveQuery(async () => {
    const all = await db.chapters.toArray();
    const map = new Map<number, number>();
    for (const c of all) {
      map.set(c.bookId, (map.get(c.bookId) ?? 0) + 1);
    }
    return map;
  }, []) ?? new Map<number, number>();

  const [filter, setFilter] = React.useState<FilterTab>('all');
  const [sort, setSort] = React.useState<SortMode>('updated');
  const [query, setQuery] = React.useState('');
  const [view, setView] = React.useState<ViewMode>('grid');
  const [storageUsed, setStorageUsed] = React.useState<number>(0);
  const [bookToDelete, setBookToDelete] = React.useState<Book | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');
  const [hoveredId, setHoveredId] = React.useState<number | null>(null);

  React.useEffect(() => {
    let mounted = true;
    estimateDbSize().then((s) => {
      if (mounted) setStorageUsed(s);
    });
    return () => {
      mounted = false;
    };
  }, [books.length]);

  const filtered = React.useMemo(() => {
    let arr = books;
    if (filter !== 'all') arr = arr.filter((b) => b.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.genre.toLowerCase().includes(q) ||
          (b.description ?? '').toLowerCase().includes(q),
      );
    }
    arr = arr.slice().sort((a, b) => {
      if (sort === 'updated') return b.updatedAt.getTime() - a.updatedAt.getTime();
      if (sort === 'created') return b.createdAt.getTime() - a.createdAt.getTime();
      return a.name.localeCompare(b.name, 'zh');
    });
    return arr;
  }, [books, filter, query, sort]);

  const stats = React.useMemo(() => {
    const ongoing = books.filter((b) => b.status === 'ongoing').length;
    const completed = books.filter((b) => b.status === 'completed').length;
    let totalChapters = 0;
    chaptersByBook.forEach((n) => (totalChapters += n));
    return { total: books.length, ongoing, completed, totalChapters };
  }, [books, chaptersByBook]);

  const handleDelete = async () => {
    if (!bookToDelete || bookToDelete.id == null) return;
    if (deleteConfirmText.trim() !== bookToDelete.name.trim()) {
      toaster.warning('书名不匹配', '请输入完整的书名以确认删除');
      return;
    }
    try {
      await deleteBookCascade(bookToDelete.id);
      toaster.success(`已删除「${bookToDelete.name}」`);
      setBookToDelete(null);
      setDeleteConfirmText('');
    } catch (e) {
      toaster.error('删除失败', (e as Error).message);
    }
  };

  return (
    <div className="min-h-screen relative bg-bg text-text">
      {/* 网格底纹 */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#E5E5E5 1px, transparent 1px), linear-gradient(90deg, #E5E5E5 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          opacity: 0.4,
        }}
      />
      {/* 扫描线 */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.012) 3px, rgba(0,0,0,0.012) 5px)`,
        }}
      />

      <div className="relative" style={{ fontFamily: FONT_MONO }}>
        {/* Header */}
        <header className="border-b-2 border-text bg-bg">
          <div className="max-w-7xl mx-auto px-4 lg:px-12 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative w-8 h-8 flex items-center justify-center border-2 border-text">
                <Terminal className="w-4 h-4 text-text" strokeWidth={1.5} />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-text" />
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold tracking-wider">作家模拟器</div>
                <div className="text-[10px] tracking-widest text-3">系统::作家_v0.1</div>
              </div>
            </Link>
            <nav className="flex items-center gap-2">
              <Link to="/settings">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border-2 border-border text-2 transition-all hover:border-text hover:text-text hover:bg-surface">
                  <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span className="hidden sm:inline">设置</span>
                </button>
              </Link>
              <Link to="/book/new">
                <Button size="sm" className="hidden lg:flex">
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} /> 新建
                </Button>
                <Button size="icon" className="lg:hidden" title="新建书籍">
                  <Plus className="w-4 h-4" strokeWidth={2} />
                </Button>
              </Link>
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 lg:px-12 py-8 lg:py-12">
          {/* Hero */}
          <section className="mb-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-text" />
                  <span className="text-[10px] tracking-[0.3em] uppercase text-2">// 系统在线</span>
                </div>
                <h1 className="text-4xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-4">
                  作家模拟器
                  <span className="block text-xl lg:text-3xl font-bold tracking-tight text-2 mt-3">
                    INITIALIZE YOUR_WORLD<span className="text-3">()</span>
                  </span>
                </h1>
                <p className="text-sm leading-relaxed max-w-md text-2">
                  &gt; 离线优先的小说创作引擎。构建世界观、塑造人物、编织命运。
                  <br />
                  &gt; 所有数据本地存储，零依赖，完全自主。
                </p>
              </div>

              {/* Stats terminal */}
              <div className="lg:col-span-4">
                <div className="border-2 border-text p-4 bg-bg shadow-[0_4px_0_0_#000]">
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b-2 border-text">
                    <Cpu className="w-3 h-3 text-text" strokeWidth={1.5} />
                    <span className="text-[10px] tracking-widest font-semibold">数据统计</span>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { label: '> 作品总数', value: stats.total, dim: false },
                      { label: '> 进行中', value: stats.ongoing, dim: false },
                      { label: '> 已完结', value: stats.completed, dim: true },
                      { label: '> 章节数', value: stats.totalChapters, dim: false },
                    ].map((s) => (
                      <div key={s.label} className="flex items-baseline justify-between text-xs">
                        <span className="text-2">{s.label}</span>
                        <span className={cn('tnum font-bold', s.dim && 'text-2')}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t border-border text-[10px] tnum text-3">
                    存储: {formatBytes(storageUsed)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 书籍库标题 */}
          <section className="mb-6">
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">书籍库</h2>
          </section>

          {/* Toolbar: filter + sort + search + view */}
          <div className="flex items-center justify-between mb-6 pb-3 border-b-2 border-text gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter pills - terminal style */}
              <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
                全部 <span className="text-3 tnum ml-1">{stats.total}</span>
              </FilterPill>
              <FilterPill active={filter === 'ongoing'} onClick={() => setFilter('ongoing')}>
                进行中 <span className="text-3 tnum ml-1">{stats.ongoing}</span>
              </FilterPill>
              <FilterPill active={filter === 'completed'} onClick={() => setFilter('completed')}>
                已完结 <span className="text-3 tnum ml-1">{stats.completed}</span>
              </FilterPill>
              <div className="w-px h-5 bg-border mx-1" />
              <SortMenu sort={sort} onChange={setSort} />
            </div>

            <div className="flex items-center gap-2">
              {/* Search - terminal style */}
              <div className="flex items-center gap-2 border-2 border-border px-3 py-1.5 focus-within:border-text transition-colors">
                <span className="text-xs text-2">$</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索作品..."
                  className="bg-transparent border-0 text-xs outline-none w-40 placeholder:text-3"
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setView('grid')}
                title="网格视图"
                className={cn(view === 'grid' && 'border-text bg-surface shadow-[0_4px_0_0_#000]')}
              >
                <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setView('list')}
                title="列表视图"
                className={cn(view === 'list' && 'border-text bg-surface shadow-[0_4px_0_0_#000]')}
              >
                <List className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Button>
            </div>
          </div>

          {/* Result count */}
          <div className="mb-4 text-[10px] tracking-widest text-3">
            [{filtered.length} / {books.length} 条结果]
          </div>

          {/* Book grid / list / empty */}
          {books.length === 0 ? (
            <EmptyState />
          ) : view === 'grid' ? (
            <BookGrid
              books={filtered}
              chapterCounts={chaptersByBook}
              onDelete={setBookToDelete}
              hoveredId={hoveredId}
              onHover={setHoveredId}
            />
          ) : (
            <BookList
              books={filtered}
              chapterCounts={chaptersByBook}
              onDelete={setBookToDelete}
            />
          )}

          {/* Footer */}
          <footer className="mt-16 pt-4 border-t-2 border-text flex items-center justify-between text-[10px] tracking-widest text-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-text" />
              <span>作家模拟器::系统 v0.1.0</span>
            </div>
            <div className="flex items-center gap-3">
              <Database className="w-3 h-3" strokeWidth={1.5} />
              <span>{books.length} 本书</span>
              <span>·</span>
              <span>{formatBytes(storageUsed)}</span>
            </div>
          </footer>
        </main>
      </div>

      {/* Delete dialog */}
      <Dialog open={!!bookToDelete} onOpenChange={(o) => !o && setBookToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <X className="w-4 h-4" strokeWidth={2} />
              <DialogTitle className="font-bold tracking-wider">删除确认</DialogTitle>
            </div>
            <DialogDescription>
              &gt; 删除「{bookToDelete?.name}」？该操作不可撤销，全部关联数据将被清除。
            </DialogDescription>
          </DialogHeader>
          {bookToDelete && (
            <DialogBody>
              <div className="text-sm leading-relaxed">
                请输入书籍名 <code className="font-mono bg-surface px-1">{bookToDelete.name}</code> 以确认：
              </div>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={bookToDelete.name}
                className="mt-3"
                autoFocus
              />
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setBookToDelete(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={!bookToDelete || deleteConfirmText.trim() !== (bookToDelete?.name.trim() ?? '###NEVER_MATCH###')}
            >
              执行删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// 子组件
// =============================================================================

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center h-9 px-3 text-xs font-semibold border-2 select-none transition-all duration-150 tracking-wider',
        active
          ? 'bg-text text-bg border-text shadow-[0_4px_0_0_#000] -translate-y-0.5'
          : 'bg-bg text-2 border-border hover:border-text hover:text-text hover:-translate-y-0.5',
      )}
    >
      {children}
    </button>
  );
}

function SortMenu({ sort, onChange }: { sort: SortMode; onChange: (s: SortMode) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const labels: Record<SortMode, string> = {
    updated: '最近编辑',
    created: '创建时间',
    name: '书名',
  };

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
        <ArrowUpDown className="w-3 h-3" strokeWidth={1.5} />
        {labels[sort]}
      </Button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-bg border-2 border-text min-w-[120px] shadow-[0_4px_0_0_#000]">
          {(Object.keys(labels) as SortMode[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
              className={cn(
                'block w-full text-left px-3 py-1.5 text-xs hover:bg-text hover:text-bg transition-colors',
                k === sort && 'font-bold bg-surface',
              )}
            >
              {labels[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// 网格视图
// =============================================================================

function BookGrid({
  books,
  chapterCounts,
  onDelete,
  hoveredId,
  onHover,
}: {
  books: Book[];
  chapterCounts: Map<number, number>;
  onDelete: (b: Book) => void;
  hoveredId: number | null;
  onHover: (id: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {books.map((b) => (
        <BookCard
          key={b.id}
          book={b}
          chapterCount={chapterCounts.get(b.id!) ?? 0}
          onDelete={() => onDelete(b)}
          onHover={onHover}
        />
      ))}
      <NewBookCard />
    </div>
  );
}

function BookCard({
  book,
  chapterCount,
  onDelete,
  onHover,
}: {
  book: Book;
  chapterCount: number;
  onDelete: () => void;
  onHover: (id: number | null) => void;
}) {
  const progress = useGameProgressSimple(book.id ?? null);
  const completed = progress?.filter((p) => p.completed).length ?? 0;
  const total = progress?.length ?? 7;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isDemo = book.name === '九州仙途';
  const isCompleted = book.status === 'completed';

  return (
    <article
      className="group relative border-2 p-5 transition-all duration-200 hover:-translate-y-1 bg-bg hover:border-text hover:shadow-[0_6px_0_0_#000] border-border shadow-[0_4px_0_0_#E5E5E5]"
      onMouseEnter={() => onHover(book.id ?? null)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Top: ID + status */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] tracking-widest tnum text-3">
          ID::{String(book.id).padStart(3, '0')}
        </span>
        <div className="flex items-center gap-1.5">
          {isDemo && (
            <span className="text-[9px] tracking-widest px-1.5 py-0.5 border border-text bg-surface">
              演示
            </span>
          )}
          <span className="text-[9px] tracking-widest flex items-center gap-1">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isCompleted ? 'bg-text' : 'bg-surface border border-text',
              )}
            />
            <span className={isCompleted ? 'text-text font-bold' : 'text-2'}>
              {isCompleted ? '已完结' : '进行中'}
            </span>
          </span>
        </div>
      </div>

      {/* Title */}
      <Link to={`/book/${book.id}`}>
        <h3 className="text-xl font-bold mb-1 truncate transition-colors text-text">
          {book.name}
        </h3>
      </Link>
      <div className="text-[10px] mb-3 tracking-wider text-3">
        :: {book.genre} · {formatDate(book.createdAt)}
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed mb-4 line-clamp-2 text-2">
        {book.description || '> 暂无简介'}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px] tracking-wider mb-4 text-3">
        <span className="inline-flex items-center gap-1">
          <ChevronRight className="w-3 h-3 text-text" strokeWidth={1.5} />
          {chapterCount} 章
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3" strokeWidth={1.5} />
          {formatDate(book.updatedAt)}
        </span>
      </div>

      {/* Progress bar - pixel blocks */}
      <div className="pt-3 border-t border-border flex items-center gap-2">
        <span className="text-[10px] tnum text-3 w-16 shrink-0">
          进度{completed}/{total}
        </span>
        <div className="flex-1 flex gap-0.5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="h-2 flex-1 transition-all"
              style={{
                background: i < completed ? '#000000' : i === completed ? '#A3A3A3' : '#F5F5F5',
              }}
            />
          ))}
        </div>
        <span className="text-[10px] tnum font-bold w-8 text-right">
          {percent}%
        </span>
      </div>

      {/* Hover enter hint */}
      <Link to={`/book/${book.id}`}>
        <div className="mt-3 flex items-center justify-center gap-1 py-1.5 border-2 border-border text-[10px] tracking-widest transition-all opacity-0 group-hover:opacity-100 group-hover:border-text group-hover:bg-text group-hover:text-bg">
          进入世界 <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
        </div>
      </Link>

      {/* Delete on hover */}
      <button
        onClick={onDelete}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center border-2 border-text bg-bg shadow-[0_2px_0_0_#000] hover:-translate-y-0.5"
        title="删除书籍"
      >
        <X className="w-3 h-3" strokeWidth={2} />
      </button>

      {/* Demo top badge */}
      {isDemo && (
        <div className="absolute -top-3 left-4 px-2 py-0.5 bg-text text-bg text-xs font-semibold z-10 shadow-[0_2px_0_0_#000]">
          演示用例
        </div>
      )}
    </article>
  );
}

// =============================================================================
// 列表视图
// =============================================================================

function BookList({
  books,
  chapterCounts,
  onDelete,
}: {
  books: Book[];
  chapterCounts: Map<number, number>;
  onDelete: (b: Book) => void;
}) {
  return (
    <div className="border-2 border-text bg-bg shadow-[0_4px_0_0_#000]">
      {books.map((b) => (
        <BookListRow
          key={b.id}
          book={b}
          chapterCount={chapterCounts.get(b.id!) ?? 0}
          onDelete={() => onDelete(b)}
        />
      ))}
      <div className="px-4 py-3 border-t-2 border-text bg-surface">
        <Link to="/book/new">
          <Button size="sm" variant="ghost" className="w-full justify-center">
            <Plus className="w-3 h-3" strokeWidth={1.5} /> 新建作品
          </Button>
        </Link>
      </div>
    </div>
  );
}

function BookListRow({
  book,
  chapterCount,
  onDelete,
}: {
  book: Book;
  chapterCount: number;
  onDelete: () => void;
}) {
  const progress = useGameProgressSimple(book.id ?? null);
  const completed = progress?.filter((p) => p.completed).length ?? 0;
  const total = progress?.length ?? 7;
  const isDemo = book.name === '九州仙途';

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b-2 border-text last:border-b-0 group transition-colors hover:bg-surface">
      <div className="text-[10px] tnum text-3 w-20 tracking-widest">
        ID::{String(book.id).padStart(3, '0')}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-md font-bold truncate">{book.name}</span>
          {isDemo && (
            <Badge variant="outline" className="bg-amber-50 border-amber-500 text-amber-900 text-xs">
              演示
            </Badge>
          )}
          <span className={cn(
            'text-[9px] tracking-widest font-bold flex items-center gap-1',
            book.status === 'completed' ? 'text-text' : 'text-3',
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              book.status === 'completed' ? 'bg-text' : 'bg-surface border border-text',
            )} />
            {book.status === 'completed' ? '已完结' : '进行中'}
          </span>
        </div>
        <div className="text-[10px] text-3 tracking-wider">
          :: {book.genre} · {chapterCount} 章 · {formatDate(book.updatedAt)}
        </div>
      </div>
      {/* Pixel progress */}
      <div className="hidden md:flex items-center gap-2 w-32">
        <div className="flex gap-0.5 flex-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="h-2 flex-1"
              style={{ background: i < completed ? '#000000' : '#F5F5F5' }}
            />
          ))}
        </div>
        <span className="text-[10px] tnum text-3">{completed}/{total}</span>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link to={`/book/${book.id}`}>
          <Button size="sm" variant="ghost">
            进入
          </Button>
        </Link>
        <Button size="icon" variant="ghost" onClick={onDelete} title="删除">
          <Trash2 className="w-3 h-3" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// 占位卡 + 空状态
// =============================================================================

function NewBookCard() {
  return (
    <Link
      to="/book/new"
      className="group flex flex-col items-center justify-center min-h-[240px] border-2 border-dashed border-text bg-bg shadow-[0_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[0_7px_0_0_#000] hover:bg-surface transition-all duration-150"
    >
      <div className="w-10 h-10 border-2 border-text flex items-center justify-center mb-3 shadow-[0_3px_0_0_#000] transition-transform duration-base group-hover:rotate-90">
        <Plus className="w-5 h-5 text-text" strokeWidth={2} />
      </div>
      <span className="text-xs font-bold tracking-widest">新建作品</span>
      <span className="text-[10px] mt-1 text-3">::空</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="border-2 border-text bg-bg py-16 px-4 text-center shadow-[0_4px_0_0_#000]">
      <div className="inline-flex items-center justify-center w-12 h-12 border-2 border-text mb-4 bg-text">
        <Terminal className="w-6 h-6 text-bg" strokeWidth={1.5} />
      </div>
      <p className="text-lg mb-2 text-2">
        &gt; 未找到数据。是否创建首部作品？
      </p>
      <p className="text-xs mb-8 text-3">
        $ 运行 新建作品 --首次
      </p>
      <Link to="/book/new">
        <Button size="sm" className="inline-flex">
          <Plus className="w-3.5 h-3.5" strokeWidth={2} /> 开始创建
        </Button>
      </Link>
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg sm:max-w-2xl mx-auto">
        {LEVELS.map((l) => (
          <div key={l.level} className="border-2 border-text bg-bg p-3 text-left shadow-[0_3px_0_0_#000]">
            <div className="text-[10px] tnum text-3 mb-1 tracking-widest">关卡{l.level}</div>
            <div className="text-sm font-bold">{l.name}</div>
            <div className="text-xs text-3 mt-1 line-clamp-2">{l.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
