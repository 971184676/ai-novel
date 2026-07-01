// =============================================================================
// ai-novel · 浏览器侧文件下载工具
// 把 Blob / 字符串作为文件触发浏览器下载。SSR 安全（document 不存在时直接返回）。
// =============================================================================

/** 把 Blob 作为文件下载 */
export function saveBlobAs(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 兼容性导出别名（保留与 fileSaver npm 包一致的 API 名称） */
export const saveAs = saveBlobAs;
