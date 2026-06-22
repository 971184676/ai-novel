import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine class names with Tailwind merge support.
 * Standard shadcn/ui helper.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a Date as YYYY-MM-DD HH:mm.
 */
export function formatDateTime(d: Date | string | undefined | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Format a Date as YYYY-MM-DD.
 */
export function formatDate(d: Date | string | undefined | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Count Chinese + English words in text (supports HTML content).
 * Chinese chars count 1 each; English words split by whitespace count 1 each.
 * HTML tags are stripped before counting.
 */
export function wordCount(text: string | undefined | null): number {
  if (!text) return 0;
  // Strip HTML tags first
  const plain = text.replace(/<[^>]*>/g, '');
  // Count CJK characters individually
  const cjkMatches = plain.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  // Remove CJK before counting English words
  const remaining = plain.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ');
  const enWords = remaining.trim().split(/\s+/).filter(Boolean).length;
  return cjkCount + enWords;
}

/** Format bytes to human-readable string (B / KB / MB) */
export function formatBytes(b: number): string {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

/** Format large number to Chinese shorthand (万 / K) */
export function formatBigNumber(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
