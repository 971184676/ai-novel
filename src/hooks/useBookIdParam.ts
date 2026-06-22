// =============================================================================
// useBookIdParam —— 解析当前路由的 :bookId 参数
// =============================================================================

import { useParams } from 'react-router-dom';

/**
 * 从当前 URL 中读取 :bookId。
 * 如果不存在（例如 /characters/:id 没有 bookId），回退到传入的 fallback。
 * 返回 number | null。
 */
export function useBookIdParam(fallback: number | null = null): number | null {
  const { bookId } = useParams<{ bookId?: string; id?: string }>();
  if (bookId) {
    const n = Number(bookId);
    return Number.isFinite(n) ? n : null;
  }
  return fallback;
}
