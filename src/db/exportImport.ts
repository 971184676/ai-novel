// =============================================================================
// ai-novel · 数据导出 / 导入工具
//
// 设计目标：
//   - 导出：把当前 book（或全部）的所有表数据打包成 JSON
//   - 导入：选 JSON 文件 → dry-run 校验 schema → 提示覆盖 → 写入
//   - 导出文件大小 > 50MB 时提示警告
//   - 文件格式包含版本号（schemaVersion）和时间戳，便于未来升级兼容
// =============================================================================

import { db } from './database';
import { saveBlobAs } from './fileSaver';
import type { Book } from './types';

/** 当前 schema 版本号。每次表结构变更时 +1 */
export const BACKUP_SCHEMA_VERSION = 3;

/** 备份文件顶层结构 */
export interface BackupBundle {
  /** 文件格式标识 */
  format: 'ai-novel-backup';
  /** schema 版本 */
  schemaVersion: number;
  /** 应用版本 */
  appVersion: string;
  /** 生成时间戳（ISO 字符串） */
  exportedAt: string;
  /** 导出范围：单书 or 全量 */
  scope: 'single-book' | 'all-data';
  /** 包含的具体书籍 id（single-book 时） */
  bookId?: number;
  /** 13 张表的数据快照（v4：关系网多画布加了 graph_canvases） */
  data: {
    books: Book[];
    world_settings: unknown[];
    characters: unknown[];
    relationships: unknown[];
    graph_canvases: unknown[];
    graph_nodes: unknown[];
    graph_edges: unknown[];
    graph_module_types: unknown[];
    cultivation_levels: unknown[];
    equipment: unknown[];
    skills: unknown[];
    factions: unknown[];
    chapters: unknown[];
  };
}

const APP_VERSION = '0.1.0';

/** 备份文件最大体积（字节）—— 超过即警告 */
export const BACKUP_WARN_SIZE_BYTES = 50 * 1024 * 1024;

/** 表名清单（用于 dry-run 校验） */
const REQUIRED_TABLES = [
  'books',
  'world_settings',
  'characters',
  'relationships',
  'graph_canvases',
  'graph_nodes',
  'graph_edges',
  'graph_module_types',
  'cultivation_levels',
  'equipment',
  'skills',
  'factions',
  'chapters',
] as const;

type TableName = (typeof REQUIRED_TABLES)[number];

/** 除 books 外的所有数据表（用于按 bookId 批量删除） */
const DATA_TABLES = [
  db.world_settings,
  db.characters,
  db.relationships,
  db.graph_canvases,
  db.graph_nodes,
  db.graph_edges,
  db.graph_module_types,
  db.cultivation_levels,
  db.equipment,
  db.skills,
  db.factions,
  db.chapters,
] as const;

/** 所有表（含 books） */
const ALL_TABLES = [db.books, ...DATA_TABLES] as const;

// =============================================================================
// 导出
// =============================================================================

export interface ExportOptions {
  /** 仅导出指定书籍（不传则导出全部） */
  bookId?: number;
  /** 文件名前缀，默认 "ai-novel-backup" */
  filenamePrefix?: string;
}

/**
 * 导出单本书的全部数据 → 触发浏览器下载。
 * 返回生成的 JSON 字符串和文件大小（字节）。
 */
export async function exportBook(bookId: number): Promise<{
  json: string;
  size: number;
  filename: string;
}> {
  const book = await db.books.get(bookId);
  if (!book) {
    throw new Error(`书籍 #${bookId} 不存在`);
  }

  const data = await collectTables(bookId);
  const bundle: BackupBundle = {
    format: 'ai-novel-backup',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    scope: 'single-book',
    bookId,
    data,
  };

  const json = JSON.stringify(bundle, null, 2);
  const size = new Blob([json]).size;
  const safeName = (book.name || `book-${bookId}`).replace(/[\\/:*?"<>|]/g, '_');
  const filename = `${safeName}-backup-${formatStamp()}.json`;

  if (size > BACKUP_WARN_SIZE_BYTES) {
    console.warn(
      `[exportImport] 备份文件 ${(size / 1024 / 1024).toFixed(1)}MB 超过 50MB，建议精简书籍内容`,
    );
  }

  triggerDownload(json, filename);
  return { json, size, filename };
}

/** 导出全量数据 → 触发浏览器下载 */
export async function exportAll(): Promise<{
  json: string;
  size: number;
  filename: string;
}> {
  const data = await collectTables();
  const bundle: BackupBundle = {
    format: 'ai-novel-backup',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    scope: 'all-data',
    data,
  };

  const json = JSON.stringify(bundle, null, 2);
  const size = new Blob([json]).size;
  const filename = `ai-novel-full-backup-${formatStamp()}.json`;

  if (size > BACKUP_WARN_SIZE_BYTES) {
    console.warn(
      `[exportImport] 备份文件 ${(size / 1024 / 1024).toFixed(1)}MB 超过 50MB，建议精简内容`,
    );
  }

  triggerDownload(json, filename);
  return { json, size, filename };
}

// =============================================================================
// 导入
// =============================================================================

export type ValidationResult =
  | { ok: true; bundle: BackupBundle }
  | { ok: false; error: string };

/** 解析 + 校验 JSON（dry-run，不写库） */
export function validateBackup(rawText: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    return { ok: false, error: `文件不是合法 JSON：${(e as Error).message}` };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: '文件顶层必须是 JSON 对象' };
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.format !== 'ai-novel-backup') {
    return { ok: false, error: '文件格式标识不匹配（期望 "ai-novel-backup"）' };
  }

  if (typeof obj.schemaVersion !== 'number') {
    return { ok: false, error: '缺少 schemaVersion 字段' };
  }
  if (obj.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `备份文件版本（v${obj.schemaVersion}）比当前应用（v${BACKUP_SCHEMA_VERSION}）更新，无法导入`,
    };
  }

  if (!obj.data || typeof obj.data !== 'object') {
    return { ok: false, error: '缺少 data 字段' };
  }
  const data = obj.data as Record<string, unknown>;
  for (const t of REQUIRED_TABLES) {
    if (!Array.isArray(data[t])) {
      return { ok: false, error: `data.${t} 不是数组` };
    }
  }

  if (obj.scope === 'single-book' && typeof obj.bookId !== 'number') {
    return { ok: false, error: '单书备份缺少 bookId 字段' };
  }

  return { ok: true, bundle: obj as unknown as BackupBundle };
}

/** dry-run 摘要：用于确认覆盖前的预览 */
export interface BackupSummary {
  scope: BackupBundle['scope'];
  exportedAt: string;
  schemaVersion: number;
  bookId?: number;
  booksCount: number;
  worldSettingsCount: number;
  charactersCount: number;
  relationshipsCount: number;
  graphNodesCount: number;
  graphEdgesCount: number;
  graphModuleTypesCount: number;
  cultivationLevelsCount: number;
  equipmentCount: number;
  skillsCount: number;
  factionsCount: number;
  chaptersCount: number;
  /** 备份中包含的书籍名（仅单书时） */
  bookName?: string;
}

export function summarizeBackup(bundle: BackupBundle): BackupSummary {
  const bookName =
    bundle.scope === 'single-book' && bundle.data.books[0]
      ? (bundle.data.books[0] as { name?: string }).name
      : undefined;
  return {
    scope: bundle.scope,
    exportedAt: bundle.exportedAt,
    schemaVersion: bundle.schemaVersion,
    bookId: bundle.bookId,
    booksCount: bundle.data.books.length,
    worldSettingsCount: bundle.data.world_settings.length,
    charactersCount: bundle.data.characters.length,
    relationshipsCount: bundle.data.relationships.length,
    graphNodesCount: (bundle.data.graph_nodes ?? []).length,
    graphEdgesCount: (bundle.data.graph_edges ?? []).length,
    graphModuleTypesCount: (bundle.data.graph_module_types ?? []).length,
    cultivationLevelsCount: bundle.data.cultivation_levels.length,
    equipmentCount: bundle.data.equipment.length,
    skillsCount: bundle.data.skills.length,
    factionsCount: bundle.data.factions.length,
    chaptersCount: bundle.data.chapters.length,
    bookName,
  };
}

export type ImportMode = 'overwrite' | 'merge';

/** 把 dry-run 校验通过的备份写入库 */
export async function applyImport(
  bundle: BackupBundle,
  mode: ImportMode = 'overwrite',
): Promise<{ booksAffected: number; chaptersAffected: number }> {
  const bookIds = bundle.data.books
    .map((b) => (b as { id?: number }).id)
    .filter((id): id is number => typeof id === 'number');

  if (mode === 'overwrite') {
    await wipeBooks(bookIds);
  }

  // 写入 books（先 book 以便外键引用）
  const newBookIds: number[] = [];
  for (const raw of bundle.data.books) {
    const old = raw as Book;
    if (old.id == null) continue;
    const { id: _drop, ...rest } = old;
    void _drop;
    const newId = (await db.books.add(rest as Book)) as number;
    newBookIds.push(newId);
  }

  const idMap = new Map<number, number>();
  if (bundle.scope === 'single-book' && bundle.bookId != null && newBookIds.length === 1) {
    idMap.set(bundle.bookId, newBookIds[0]);
  } else if (bundle.scope === 'all-data') {
    bundle.data.books.forEach((raw, i) => {
      const old = raw as Book;
      if (old.id != null && newBookIds[i] != null) {
        idMap.set(old.id, newBookIds[i]);
      }
    });
  }

  const remapBookId = (oldId: number | undefined): number | undefined => {
    if (oldId == null) return undefined;
    return idMap.get(oldId) ?? oldId;
  };

  // 写入其余表（按依赖顺序：graph_canvases 必须在 graph_nodes/edges 之前）
  const writers: Array<{ rows: unknown[]; add: (v: unknown) => Promise<unknown> }> = [
    { rows: bundle.data.world_settings, add: (v) => db.world_settings.add(v as never) },
    { rows: bundle.data.characters, add: (v) => db.characters.add(v as never) },
    { rows: bundle.data.relationships, add: (v) => db.relationships.add(v as never) },
    { rows: bundle.data.graph_canvases ?? [], add: (v) => db.graph_canvases.add(v as never) },
    { rows: bundle.data.graph_nodes ?? [], add: (v) => db.graph_nodes.add(v as never) },
    { rows: bundle.data.graph_edges ?? [], add: (v) => db.graph_edges.add(v as never) },
    { rows: bundle.data.graph_module_types ?? [], add: (v) => db.graph_module_types.add(v as never) },
    { rows: bundle.data.cultivation_levels, add: (v) => db.cultivation_levels.add(v as never) },
    { rows: bundle.data.equipment, add: (v) => db.equipment.add(v as never) },
    { rows: bundle.data.skills, add: (v) => db.skills.add(v as never) },
    { rows: bundle.data.factions, add: (v) => db.factions.add(v as never) },
    { rows: bundle.data.chapters, add: (v) => db.chapters.add(v as never) },
  ];

  for (const w of writers) {
    for (const raw of w.rows) {
      const r: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
      delete r.id;
      if (typeof r.bookId === 'number') {
        r.bookId = remapBookId(r.bookId);
      }
      if (r.bookId == null) continue;
      await w.add(r);
    }
  }

  return {
    booksAffected: newBookIds.length,
    chaptersAffected: bundle.data.chapters.length,
  };
}

/** 清空全库（用于 Settings 的"清空所有数据"危险操作） */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', ALL_TABLES, async () => {
    await Promise.all(ALL_TABLES.map((t) => t.clear()));
  });
}

/** 删除单本书及其全部关联数据 */
export async function deleteBookCascade(bookId: number): Promise<void> {
  await db.transaction('rw', ALL_TABLES, async () => {
    await Promise.all([
      ...DATA_TABLES.map((t) => t.where('bookId').equals(bookId).delete()),
      db.books.delete(bookId),
    ]);
  });
}

/** 估算 IndexedDB 当前使用量（字节）—— 用于首页/设置页显示 */
export async function estimateDbSize(): Promise<number> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return 0;
  }
  try {
    const est = await navigator.storage.estimate();
    return est.usage ?? 0;
  } catch {
    return 0;
  }
}

// =============================================================================
// 内部辅助
// =============================================================================

/**
 * 收集所有表数据。传入 bookId 则只收集该书数据，否则收集全部。
 */
async function collectTables(bookId?: number): Promise<BackupBundle['data']> {
  const [
    books,
    world_settings,
    characters,
    relationships,
    graph_canvases,
    graph_nodes,
    graph_edges,
    graph_module_types,
    cultivation_levels,
    equipment,
    skills,
    factions,
    chapters,
  ] = await Promise.all([
    bookId != null ? db.books.where({ id: bookId }).toArray() : db.books.toArray(),
    query(bookId, db.world_settings),
    query(bookId, db.characters),
    query(bookId, db.relationships),
    query(bookId, db.graph_canvases),
    query(bookId, db.graph_nodes),
    query(bookId, db.graph_edges),
    query(bookId, db.graph_module_types),
    query(bookId, db.cultivation_levels),
    query(bookId, db.equipment),
    query(bookId, db.skills),
    query(bookId, db.factions),
    query(bookId, db.chapters),
  ]);

  return {
    books,
    world_settings,
    characters,
    relationships,
    graph_canvases,
    graph_nodes,
    graph_edges,
    graph_module_types,
    cultivation_levels,
    equipment,
    skills,
    factions,
    chapters,
  };
}

/** 如果 bookId 存在则按 bookId 过滤，否则取全部 */
function query<T>(bookId: number | undefined, table: { where: (key: string) => { equals: (v: number) => { toArray: () => Promise<T[]> } }; toArray: () => Promise<T[]> }): Promise<T[]> {
  if (bookId != null) {
    return table.where('bookId').equals(bookId).toArray();
  }
  return table.toArray();
}

async function wipeBooks(bookIds: number[]): Promise<void> {
  if (bookIds.length === 0) return;
  await db.transaction('rw', ALL_TABLES, async () => {
    for (const id of bookIds) {
      await Promise.all(
        DATA_TABLES.map((t) => t.where('bookId').equals(id).delete()),
      );
    }
    await db.books.bulkDelete(bookIds);
  });
}

function formatStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}

function triggerDownload(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  saveBlobAs(blob, filename);
}