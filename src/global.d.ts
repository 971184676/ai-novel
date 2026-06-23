import type { NovelDB } from '@/db/database';

declare global {
  interface Window {
    /** 调试用：暴露 IndexedDB 实例到 DevTools */
    db: NovelDB;
  }
}

export {};