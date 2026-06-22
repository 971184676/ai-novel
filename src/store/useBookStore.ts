// =============================================================================
// novel-creator · Zustand store
// 用 slice 模式拆分：bookSlice / chapterSlice / uiSlice
// 持久化不重要（IndexedDB 已经持久化），这里只维护运行时状态
// =============================================================================

import { create, type StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';

// ====== Slice: book（当前书籍）======
export interface BookSlice {
  currentBookId: number | null;
  setCurrentBookId: (id: number | null) => void;
}

const createBookSlice: StateCreator<
  BookSlice & ChapterSlice & UiSlice,
  [['zustand/devtools', never]],
  [],
  BookSlice
> = (set) => ({
  currentBookId: null,
  setCurrentBookId: (id) => set({ currentBookId: id }, false, 'book/setCurrentBookId'),
});

// ====== Slice: chapter（当前章节）======
export interface ChapterSlice {
  currentChapterId: number | null;
  currentChapterNumber: number | null;
  setCurrentChapter: (id: number | null, num?: number | null) => void;
}

const createChapterSlice: StateCreator<
  BookSlice & ChapterSlice & UiSlice,
  [['zustand/devtools', never]],
  [],
  ChapterSlice
> = (set) => ({
  currentChapterId: null,
  currentChapterNumber: null,
  setCurrentChapter: (id, num = null) =>
    set(
      { currentChapterId: id, currentChapterNumber: num },
      false,
      'chapter/setCurrentChapter',
    ),
});

// ====== Slice: ui（侧栏 / 主题）======
export interface UiSlice {
  sidebarOpen: boolean;
  themeMode: 'light'; // 项目锁定 light，不做深色模式
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const createUiSlice: StateCreator<
  BookSlice & ChapterSlice & UiSlice,
  [['zustand/devtools', never]],
  [],
  UiSlice
> = (set) => ({
  sidebarOpen: true,
  themeMode: 'light',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen }), false, 'ui/toggleSidebar'),
  setSidebarOpen: (open) => set({ sidebarOpen: open }, false, 'ui/setSidebarOpen'),
});

// ====== 合并 ======
export type AppState = BookSlice & ChapterSlice & UiSlice;

export const useBookStore = create<AppState>()(
  devtools(
    (...a) => ({
      ...createBookSlice(...a),
      ...createChapterSlice(...a),
      ...createUiSlice(...a),
    }),
    { name: 'novel-creator-store' },
  ),
);
