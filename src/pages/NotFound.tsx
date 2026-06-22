// =============================================================================
// novel-creator · 404 兜底页
// =============================================================================

import { Link } from 'react-router-dom';
import { Home as HomeIcon, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-text px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-xs tnum text-3 mb-3">ERROR · 404</div>
        <div className="text-3xl font-semibold tnum mb-4">404</div>
        <h1 className="text-xl font-semibold mb-3">页面不存在</h1>
        <p className="text-sm text-2 leading-relaxed mb-8">
          你访问的链接可能已失效，或书籍已被删除。数据仍在本地浏览器中，未丢失。
        </p>
        <div className="flex items-center justify-center gap-2">
          <Link to="/">
            <Button variant="primary" size="sm">
              <HomeIcon className="w-3 h-3" strokeWidth={1.5} /> 返回首页
            </Button>
          </Link>
          <Link to="/book/new">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-3 h-3" strokeWidth={1.5} /> 新建书籍
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
