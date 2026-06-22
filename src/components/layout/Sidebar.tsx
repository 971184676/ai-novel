import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Globe,
  Users,
  GitFork,
  Layers,
  Sword,
  Zap,
  Flag,
  Feather,
  ChevronLeft,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 侧边栏 —— 每个 /book/:bookId/* 路由都会渲染。
 * 三个分组：世界 / 设定 / 创作；最底"返回书籍库"。
 */
export function Sidebar() {
  const { bookId } = useParams<{ bookId: string }>();

  if (!bookId) return null;

  return (
    <aside className="w-[240px] shrink-0 border-r-2 border-text bg-bg flex flex-col h-screen sticky top-0 shadow-[4px_0_0_0_#E5E5E5]">
      <div className="px-6 pt-6 pb-4 border-b-2 border-text">
        <NavLink
          to="/"
          className="inline-flex items-center gap-2 text-xs text-2 hover:text-text border-2 border-transparent hover:border-text px-2 py-1 transition-all"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={1.5} />
          <span>返回书籍库</span>
        </NavLink>
        <div className="mt-3 text-xs tnum text-3">BOOK · #{bookId}</div>
        <div className="mt-1 text-md font-semibold truncate">当前书籍</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
        <SidebarSection title="世界">
          <SidebarLink to={`/book/${bookId}`} icon={LayoutDashboard} label="总览" end />
          <SidebarLink to={`/book/${bookId}/world`} icon={Globe} label="世界观" />
          <SidebarLink to={`/book/${bookId}/characters`} icon={Users} label="人物库" />
          <SidebarLink
            to={`/book/${bookId}/relationships`}
            icon={GitFork}
            label="关系网"
          />
        </SidebarSection>

        <SidebarSection title="设定">
          <SidebarLink
            to={`/book/${bookId}/cultivation`}
            icon={Layers}
            label="修行境界"
          />
          <SidebarLink to={`/book/${bookId}/equipment`} icon={Sword} label="装备" />
          <SidebarLink to={`/book/${bookId}/skills`} icon={Zap} label="技能" />
          <SidebarLink to={`/book/${bookId}/factions`} icon={Flag} label="阵营" />
        </SidebarSection>

        <SidebarSection title="创作">
          <SidebarLink to={`/book/${bookId}/chapters`} icon={Feather} label="章节" />
        </SidebarSection>
      </nav>

      <div className="px-6 py-4 border-t-2 border-text text-xs tnum text-3">
        v0.1 · local-first
      </div>
    </aside>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-2 mb-2 text-xs font-semibold tracking-wider uppercase text-2">
        {title}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  end,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 text-sm font-medium border-2 transition-all select-none',
          isActive
            ? 'bg-bg text-text border-text shadow-[0_3px_0_0_#000] -translate-y-0.5'
            : 'bg-bg text-text border-transparent shadow-none hover:border-text hover:shadow-[0_2px_0_0_#E5E5E5] hover:-translate-y-0.5 active:translate-y-[1px] active:shadow-none',
        )
      }
    >
      <Icon className="w-4 h-4" strokeWidth={1.5} />
      <span>{label}</span>
    </NavLink>
  );
}
