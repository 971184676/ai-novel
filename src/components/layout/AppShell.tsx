import { Outlet, useParams, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';

const BUILD_STAMP = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

const ROUTE_LABELS: Record<string, string> = {
  '': '总览',
  world: '世界观',
  characters: '人物库',
  relationships: '关系网',
  map: '地图',
  cultivation: '修行境界',
  equipment: '装备',
  skills: '技能',
  factions: '阵营',
  chapters: '章节',
};

/**
 * AppShell —— 套在 /book/:bookId/* 路由外层。
 * 包含：左侧 Sidebar + 右侧（顶部面包屑 + Outlet）
 */
export function AppShell() {
  const { bookId } = useParams<{ bookId: string }>();
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  // segments: ['book', ':bookId', '<sub>', ...]
  const sub = segments[2] ?? '';
  const subSub = segments[3]; // for character detail page
  const pageLabel = ROUTE_LABELS[sub] ?? '页面';

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b-2 border-text px-8 flex items-center justify-between bg-bg sticky top-0 z-10 shadow-[0_3px_0_0_#E5E5E5]">
          <div className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-2 hover:text-text">
              首页
            </Link>
            <ChevronRight className="w-3 h-3 text-3" strokeWidth={1.5} />
            <Link
              to={`/book/${bookId}`}
              className="text-2 hover:text-text truncate max-w-[200px]"
            >
              书籍 #{bookId}
            </Link>
            <ChevronRight className="w-3 h-3 text-3" strokeWidth={1.5} />
            <span className="text-text font-medium">{pageLabel}</span>
            {subSub && (
              <>
                <ChevronRight className="w-3 h-3 text-3" strokeWidth={1.5} />
                <span className="text-2 tnum">#{subSub}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-3 tnum">local-first · v0.1 · build {BUILD_STAMP}</div>
        </header>
        <main className="flex-1 min-w-0 px-12 py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
