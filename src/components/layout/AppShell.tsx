import { Outlet, useParams, useLocation } from 'react-router-dom';
import { ChevronRight, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useState } from 'react';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const segments = location.pathname.split('/').filter(Boolean);
  // segments: ['book', ':bookId', '<sub>', ...]
  const sub = segments[2] ?? '';
  const subSub = segments[3]; // for character detail page
  const pageLabel = ROUTE_LABELS[sub] ?? '页面';

  return (
    <div className="flex h-screen min-h-screen bg-bg text-text">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile unless open */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
          lg:relative lg:transform-none lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full">
        {/* Mobile header */}
        <header className="h-14 border-b-2 border-text px-4 flex items-center justify-between bg-bg sticky top-0 z-10 shadow-[0_3px_0_0_#E5E5E5] lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 hover:bg-surface-2 transition-colors"
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <div className="flex items-center gap-1.5 text-sm truncate max-w-[180px]">
            <Link to="/" className="text-2 hover:text-text">
              首页
            </Link>
            <ChevronRight className="w-3 h-3 text-3" strokeWidth={1.5} />
            <span className="font-medium truncate">{pageLabel}</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Desktop header */}
        <header className="h-14 border-b-2 border-text px-8 flex items-center justify-between bg-bg sticky top-0 z-10 shadow-[0_3px_0_0_#E5E5E5] hidden lg:flex">
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
        <main className="flex-1 min-w-0 min-h-0 h-full px-4 py-6 lg:px-12 lg:py-10 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
