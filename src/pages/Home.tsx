// =============================================================================
// novel-creator · 首页
// 路径 /
//   - 顶部：Logo + Slogan + 设置 + 新建书籍主按钮
//   - Hero：累计统计（总书数 / 进行中 / 已完结 / 总字数 / 存储）
//   - 主体：书籍卡片网格 + "创建新书"占位卡
//   - 每张卡片：编号 / 状态徽章 / 名称 / 类型 / 章节数 / 更新时间 / LEVEL 进度线 / 操作
// =============================================================================

import * as React from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  Plus,
  Settings,
  Trash2,
  ArrowUpDown,
  LayoutGrid,
  List,
  Search,
  Database,
  ExternalLink,
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

  // 估算存储用量
  React.useEffect(() => {
    let mounted = true;
    estimateDbSize().then((s) => {
      if (mounted) setStorageUsed(s);
    });
    return () => {
      mounted = false;
    };
  }, [books.length]);

  // 过滤 + 搜索
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
    // 排序
    arr = arr.slice().sort((a, b) => {
      if (sort === 'updated') return b.updatedAt.getTime() - a.updatedAt.getTime();
      if (sort === 'created') return b.createdAt.getTime() - a.createdAt.getTime();
      return a.name.localeCompare(b.name, 'zh');
    });
    return arr;
  }, [books, filter, query, sort]);

  // 统计
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
    <div className="min-h-screen bg-bg text-text">
      <TopBar />

      <main className="max-w-7xl mx-auto px-12 py-10">
        <Hero stats={stats} />

        {/* 过滤栏 */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
              全部 <span className="text-3 tnum ml-1">{stats.total}</span>
            </FilterPill>
            <FilterPill active={filter === 'ongoing'} onClick={() => setFilter('ongoing')}>
              进行中 <span className="text-3 tnum ml-1">{stats.ongoing}</span>
            </FilterPill>
            <FilterPill active={filter === 'completed'} onClick={() => setFilter('completed')}>
              已完结 <span className="text-3 tnum ml-1">{stats.completed}</span>
            </FilterPill>
            <div className="w-px h-4 bg-border mx-1" />
            <SortMenu sort={sort} onChange={setSort} />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-3"
                strokeWidth={1.5}
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索书名 / 类型 / 简介"
                className="w-64 pl-7"
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setView('grid')}
              title="网格视图"
              className={cn(
                view === 'grid' && 'border-text bg-surface shadow-[0_4px_0_0_#000]',
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setView('list')}
              title="列表视图"
              className={cn(
                view === 'list' && 'border-text bg-surface shadow-[0_4px_0_0_#000]',
              )}
            >
              <List className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        {/* 主体：卡片 / 空状态 */}
        {books.length === 0 ? (
          <EmptyState />
        ) : view === 'grid' ? (
          <BookGrid
            books={filtered}
            chapterCounts={chaptersByBook}
            onDelete={setBookToDelete}
          />
        ) : (
          <BookList
            books={filtered}
            chapterCounts={chaptersByBook}
            onDelete={setBookToDelete}
          />
        )}

        <Footer storageUsed={storageUsed} bookCount={books.length} />
      </main>

      {/* 删除确认 */}
      <Dialog open={!!bookToDelete} onOpenChange={(o) => !o && setBookToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除书籍？</DialogTitle>
            <DialogDescription>
              将同时删除该书的全部人物、地图、境界、装备、技能、阵营和章节。该操作不可撤销。
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
              确认删除
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

function TopBar() {
  return (
    <header className="border-b border-border">
      <div className="max-w-7xl mx-auto px-12 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-bg border-2 border-text flex items-center justify-center shadow-[0_3px_0_0_#000]">
            <BookOpen className="w-4 h-4 text-text" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-md font-semibold">小说创作辅助平台</div>
            <div className="text-xs text-3">本地存储 · 零后端 · 离线可用</div>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/settings">
            <Button size="sm" variant="ghost">
              <Settings className="w-3 h-3" strokeWidth={1.5} /> 设置
            </Button>
          </Link>
          <Link to="/book/new">
            <Button size="sm" variant="ghost">
              <Plus className="w-3 h-3" strokeWidth={1.5} /> 新建书籍
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero({ stats }: { stats: { total: number; ongoing: number; completed: number; totalChapters: number } }) {
  return (
    <section className="grid grid-cols-12 gap-8 mb-12">
      <div className="col-span-7">
        <div className="text-xs tnum text-3 mb-3">SECTION 01 / LIBRARY</div>
        <h1 className="text-3xl font-semibold mb-3 leading-tight">书籍库</h1>
        <p className="text-sm text-2 max-w-md leading-relaxed">
          所有作品保存在本地浏览器。从创建一本新书开始，逐步构建世界观、人物、地图，最终输出一部完整小说。
        </p>
      </div>
      <div className="col-span-5">
        <div className="panel-3d">
          <div className="flex items-baseline justify-between p-4 border-b-2 border-text">
            <div className="text-xs tnum text-3">TOTAL · 累计</div>
            <div className="text-2xl font-semibold tnum">{stats.total}</div>
          </div>
          <div className="grid grid-cols-3">
            <HeroStat label="进行中" value={stats.ongoing} border />
            <HeroStat label="已完结" value={stats.completed} border />
            <HeroStat label="总章节" value={stats.totalChapters} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  border,
}: {
  label: string;
  value: number;
  border?: boolean;
}) {
  return (
    <div className={cn('py-3 px-3', border && 'border-r-2 border-text')}>
      <div className="text-xs text-3 mb-1">{label}</div>
      <div className="text-md font-semibold tnum">{value}</div>
    </div>
  );
}

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
        'inline-flex items-center h-9 px-3.5 text-xs font-semibold border-2 select-none transition-all duration-150',
        active
          ? 'bg-bg text-text border-text shadow-[0_4px_0_0_#000] -translate-y-0.5'
          : 'bg-bg text-text border-border shadow-[0_4px_0_0_#E5E5E5] hover:border-text hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#E5E5E5] active:translate-y-[3px] active:shadow-[0_1px_0_0_#E5E5E5]',
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
        <div className="absolute top-full left-0 mt-1 z-20 bg-bg border border-text min-w-[120px]">
          {(Object.keys(labels) as SortMode[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
              className={cn(
                'block w-full text-left px-3 py-1.5 text-xs hover:bg-surface',
                k === sort && 'font-semibold',
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
}: {
  books: Book[];
  chapterCounts: Map<number, number>;
  onDelete: (b: Book) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-6">
      {books.map((b) => (
        <BookCard
          key={b.id}
          book={b}
          chapterCount={chapterCounts.get(b.id!) ?? 0}
          onDelete={() => onDelete(b)}
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
}: {
  book: Book;
  chapterCount: number;
  onDelete: () => void;
}) {
  const progress = useGameProgressSimple(book.id ?? null);
  const completed = progress?.filter((p) => p.completed).length ?? 0;
  const total = progress?.length ?? 6;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isDemo = book.name === '九州仙途';

  return (
    <article className="border-2 border-text bg-bg p-6 flex flex-col shadow-[0_4px_0_0_#000] transform translate-y-0 hover:-translate-y-1 hover:shadow-[0_7px_0_0_#000] transition-all duration-150 group relative">
      {/* 演示用例标识 */}
      {isDemo && (
        <div className="absolute -top-3 left-4 px-2 py-0.5 bg-amber-500 text-text text-xs font-semibold z-10">
          演示用例
        </div>
      )}

      {/* 操作菜单 */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDelete}
          className="inline-flex items-center justify-center w-9 h-9 border-2 border-text bg-bg shadow-[0_3px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#000] active:translate-y-[2px] active:shadow-[0_1px_0_0_#000] transition-all duration-150"
          title="删除书籍"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex items-start justify-between mb-4">
        <div className="text-xs tnum text-3">
          #{String(book.id).padStart(3, '0')}
        </div>
        <div className="flex items-center gap-2">
          {isDemo && (
            <Badge variant="outline" className="bg-amber-50 border-amber-500 text-amber-900">
              演示
            </Badge>
          )}
          <Badge variant={book.status === 'completed' ? 'solid' : 'outline'}>
            {book.status === 'completed' ? '已完结' : '进行中'}
          </Badge>
        </div>
      </div>

      <h3 className="text-xl font-semibold mb-1 truncate" title={book.name}>
        {book.name}
      </h3>
      <div className="text-xs text-2 mb-3 tnum">
        {book.genre} · 创建 {formatDate(book.createdAt)}
      </div>

      <p className="text-xs text-2 leading-relaxed flex-1 line-clamp-3 mb-4 min-h-[3em]">
        {book.description || <span className="text-3">（暂无简介）</span>}
      </p>

      {/* 数据行 */}
      <div className="flex gap-3 text-xs text-2 tnum mb-4">
        <span>章节 {chapterCount}</span>
        <span className="text-3">·</span>
        <span>更新 {formatDate(book.updatedAt)}</span>
      </div>

      {/* 进度条（线段） */}
      <div className="mt-auto pt-4 border-t border-border flex items-center gap-2 text-xs">
        <span className="tnum text-3 w-16 shrink-0">LEVEL {completed}/{total}</span>
        <span className="progress-line flex-1 truncate">
          <ProgressLine completed={completed} current={progress?.find((p) => p.current)?.level ?? 0} total={total} />
        </span>
        <span className="tnum w-10 text-right">{percent}%</span>
      </div>

      {/* 进入按钮 */}
      <Link to={`/book/${book.id}`} className="mt-4">
        <Button size="sm" variant="ghost" className="w-full">
          <ExternalLink className="w-3 h-3" strokeWidth={1.5} /> 进入
        </Button>
      </Link>
    </article>
  );
}

function ProgressLine({ completed, current, total }: { completed: number; current: number; total: number }) {
  // 每段 4 字符：━━━ 或 ┄┄┄
  const segments: string[] = [];
  for (let i = 1; i <= total; i++) {
    if (i <= completed) segments.push('━━━');
    else if (i === current) segments.push('━ ┄');
    else segments.push('┄┄┄');
  }
  return <>{segments.join(' ')}</>;
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
    <div className="list-3d">
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
            <Plus className="w-3 h-3" strokeWidth={1.5} /> 创建新书
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
  const total = progress?.length ?? 6;
  const isDemo = book.name === '九州仙途';

  return (
    <div className="list-row-3d flex items-center gap-4 px-4 py-3 border-b-2 border-text last:border-b-0 group">
      <div className="text-xs tnum text-3 w-14">#{String(book.id).padStart(3, '0')}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-md font-semibold truncate">{book.name}</span>
          {isDemo && (
            <Badge variant="outline" className="bg-amber-50 border-amber-500 text-amber-900 text-xs">
              演示
            </Badge>
          )}
          <Badge variant={book.status === 'completed' ? 'solid' : 'outline'}>
            {book.status === 'completed' ? '已完结' : '进行中'}
          </Badge>
        </div>
        <div className="text-xs text-2 tnum">
          {book.genre} · 章节 {chapterCount} · 更新 {formatDate(book.updatedAt)}
        </div>
      </div>
      <div className="hidden md:block text-xs tnum text-3 w-32 truncate progress-line">
        <ProgressLine completed={completed} current={progress?.find((p) => p.current)?.level ?? 0} total={total} />
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
      className="border-2 border-dashed border-text bg-bg text-text flex flex-col items-center justify-center min-h-[280px] shadow-[0_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[0_7px_0_0_#000] hover:bg-surface group transition-all duration-150"
    >
      <Plus
        className="w-8 h-8 mb-3 transition-transform duration-base group-hover:rotate-90"
        strokeWidth={1.5}
      />
      <div className="text-sm font-semibold">创建新书</div>
      <div className="text-xs mt-1 text-3">从零开始</div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="panel-3d py-20 px-8 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-text mb-6 shadow-[0_4px_0_0_#000]">
        <BookOpen className="w-8 h-8" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-semibold mb-3">创建你的第一部小说</h2>
      <p className="text-sm text-2 leading-relaxed max-w-md mx-auto mb-8">
        从一本新书开始，逐步构建世界观、人物、地图、修行境界、阵营，最终写出完整章节。
        所有数据保存在浏览器本地，无需注册、无需联网。
      </p>
      <Link to="/book/new">
        <Button size="lg" variant="ghost">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> 创建你的第一部小说
        </Button>
      </Link>
      <div className="mt-12 grid grid-cols-4 gap-2 max-w-2xl mx-auto">
        {LEVELS.map((l) => (
          <div key={l.level} className="border-2 border-text bg-bg p-4 text-left shadow-[0_3px_0_0_#000]">
            <div className="text-xs tnum text-3 mb-1">L{l.level}</div>
            <div className="text-sm font-semibold">{l.name}</div>
            <div className="text-xs text-3 mt-1 line-clamp-2">{l.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Footer mini
// =============================================================================

function Footer({ storageUsed, bookCount }: { storageUsed: number; bookCount: number }) {
  return (
    <footer className="mt-16 pt-6 border-t border-border flex items-center justify-between text-xs text-3 tnum flex-wrap gap-2">
      <div>Novel Creator · v0.1.0 · 离线优先</div>
      <div className="flex items-center gap-4">
        <span>本地数据库：IndexedDB</span>
        <span className="text-3">·</span>
        <span>
          <Database className="inline w-3 h-3 mr-1" strokeWidth={1.5} />
          {bookCount} 本书 · 已用 {formatBytes(storageUsed)}
        </span>
      </div>
    </footer>
  );
}


