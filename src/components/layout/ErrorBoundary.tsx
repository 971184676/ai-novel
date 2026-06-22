// =============================================================================
// novel-creator · 全局 Error Boundary
// 捕获子组件树中的渲染错误，提供兜底页面和"返回首页"按钮。
// =============================================================================

import * as React from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** 自定义兜底文案（可选） */
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** 触发 reset 的 key（从 1 开始递增，每次重置后 +1） */
  resetKey: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    resetKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // 在控制台输出，便于开发
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, info);
  }

  handleReset = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg text-text px-6">
          <div className="max-w-xl w-full border border-border bg-bg p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertOctagon className="w-5 h-5 text-text" strokeWidth={1.5} />
              <div className="text-md font-semibold">页面出错了</div>
            </div>
            <p className="text-sm text-2 leading-relaxed mb-4">
              {this.props.fallbackTitle ??
                '应用遇到了一个未预期的错误。这通常是渲染数据或浏览器环境的问题，不会影响你的本地数据（IndexedDB 仍然完好）。'}
            </p>
            {this.state.error && (
              <details className="mb-4 border border-border bg-surface p-3 text-xs">
                <summary className="cursor-pointer text-2 mb-1">查看错误详情</summary>
                <pre className="font-mono whitespace-pre-wrap break-all text-text-2 mt-2">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={this.handleReset}>
                <RotateCcw className="w-3 h-3" strokeWidth={1.5} /> 重试
              </Button>
              <Link to="/">
                <Button variant="ghost" size="sm">
                  返回首页
                </Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }
    // 用 key 让子树在 reset 后强制重建
    return (
      <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>
    );
  }
}
