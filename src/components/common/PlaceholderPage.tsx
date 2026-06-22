interface PlaceholderProps {
  title: string;
  hint?: string;
}

/**
 * 通用占位页：所有尚未实现的页面都用这个组件。
 * 严格对齐设计 token（白底 + 1px 黑边 + 几何精确）。
 */
export function PlaceholderPage({ title, hint }: PlaceholderProps) {
  return (
    <div className="max-w-3xl">
      <div className="text-xs tnum text-3 mb-3">即将实现 · PLACEHOLDER</div>
      <h1 className="text-2xl font-semibold mb-3">{title}</h1>
      <p className="text-sm text-2 mb-8 leading-relaxed">
        {hint ?? '此页面骨架已就绪，业务实现由对应 dev agent 接管。'}
      </p>
      <div className="border border-border p-6 bg-surface">
        <div className="text-xs tnum text-3 mb-2">骨架状态</div>
        <ul className="text-sm text-2 leading-7">
          <li>· React Router 路由已挂载</li>
          <li>· Dexie 数据库连接已就绪（11 张表）</li>
          <li>· Zustand store 已挂载</li>
          <li>· Tailwind + shadcn 主题已应用</li>
        </ul>
      </div>
    </div>
  );
}
