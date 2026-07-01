// =============================================================================
// ai-novel · App 顶层
// 路由 + 全局 Toast + 错误边界
// =============================================================================

import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes';
import { ToasterProvider } from '@/hooks/useToaster';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <ToasterProvider>
        <RouterProvider router={router} />
      </ToasterProvider>
    </ErrorBoundary>
  );
}
