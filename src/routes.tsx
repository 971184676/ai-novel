// =============================================================================
// novel-creator · 路由集中配置
// 13 条路由（严格对齐 开发文档 第十一节）
// =============================================================================

import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';

// 顶层页面（无 sidebar）
import Home from '@/pages/Home';
import NewBook from '@/pages/NewBook';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';

// /book/:bookId/* 页面（带 sidebar via AppShell）
import BookOverview from '@/pages/BookOverview';
import World from '@/pages/World';
import Characters from '@/pages/Characters';
import CharacterDetail from '@/pages/CharacterDetail';
import RelationshipGraph from '@/pages/RelationshipGraph';
import Cultivation from '@/pages/Cultivation';
import Equipment from '@/pages/Equipment';
import Skills from '@/pages/Skills';
import Factions from '@/pages/Factions';
import Chapters from '@/pages/Chapters';

export const router = createBrowserRouter(
  [
    { path: '/', element: <Home /> },
    { path: '/book/new', element: <NewBook /> },
    { path: '/settings', element: <Settings /> },

    {
      path: '/book/:bookId',
      element: <AppShell />,
      children: [
        { index: true, element: <BookOverview /> },
        { path: 'world', element: <World /> },
        { path: 'characters', element: <Characters /> },
        { path: 'characters/:id', element: <CharacterDetail /> },
        { path: 'relationships', element: <RelationshipGraph /> },
        { path: 'cultivation', element: <Cultivation /> },
        { path: 'equipment', element: <Equipment /> },
        { path: 'skills', element: <Skills /> },
        { path: 'factions', element: <Factions /> },
        { path: 'chapters', element: <Chapters /> },
      ],
    },

    { path: '*', element: <NotFound /> },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);

/** 路由清单（供 UI / 导航引用）*/
export const ROUTES = [
  { path: '/', label: '首页', page: 'Home' },
  { path: '/book/new', label: '新建书籍', page: 'NewBook' },
  { path: '/book/:bookId', label: '书籍总览', page: 'BookOverview' },
  { path: '/book/:bookId/world', label: '世界观', page: 'World' },
  { path: '/book/:bookId/characters', label: '人物库', page: 'Characters' },
  { path: '/book/:bookId/characters/:id', label: '人物详情', page: 'CharacterDetail' },
  { path: '/book/:bookId/relationships', label: '关系网', page: 'RelationshipGraph' },
  { path: '/book/:bookId/cultivation', label: '修行境界', page: 'Cultivation' },
  { path: '/book/:bookId/equipment', label: '装备', page: 'Equipment' },
  { path: '/book/:bookId/skills', label: '技能', page: 'Skills' },
  { path: '/book/:bookId/factions', label: '阵营', page: 'Factions' },
  { path: '/book/:bookId/chapters', label: '章节', page: 'Chapters' },
  { path: '/settings', label: '设置', page: 'Settings' },
] as const;
